<?php

namespace App\Services\Core\Connection;

use App\Enums\Permission;
use App\Models\Core\ModelConnection;
use App\Models\Model;
use App\Services\Core\PermissionChecker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class RelationPanelService {
    /**
     * Susun payload panel relasi untuk dokumen. Hanya tipe yang dideklarasikan
     * di expectedRelationPanels() yang dikembalikan, dalam urutan deklarasi.
     *
     * `detail_columns` dan `detail_rows` hanya ada bila tipe tujuan punya
     * relationPanelDetail(). `remainder` hanya ada bila barisnya tidak kosong.
     *
     * @return array<int, array{
     *   reference_type: string,
     *   title: string,
     *   columns: array<int, array{key: string, label: string, align: string, format?: string, aggregate?: string}>,
     *   rows: array<int, array<string, mixed>>,
     *   totals: array<string, mixed>,
     *   action: array{url: string, label: string}|null,
     *   is_empty: bool,
     *   route: string,
     *   detail_columns?: array<int, array{key: string, label: string, align: string, format?: string}>,
     *   remainder?: array{title: string, columns: array<int, array<string, mixed>>, rows: array<int, array<string, mixed>>}
     * }>
     */
    public function build(Model $document): array {
        $expectedPanels = $document::expectedRelationPanels();
        if ($expectedPanels === []) {
            return [];
        }

        // Panel yang bersumber `source` tidak memakai ModelConnection. Bila semua
        // panel begitu, query koneksi dilewati sepenuhnya.
        $needsConnections = collect($expectedPanels)
            ->contains(fn (array $expected): bool => ! isset($expected['source']));

        $connections = $needsConnections
            ? $this->loadConnections($document)
                // Baris audit memakai reference_type penanda bebas, bukan nama kelas model.
                ->filter(fn (ModelConnection $connection): bool => is_subclass_of($connection->reference_type ?? '', Model::class))
                ->groupBy('reference_type')
            : collect();

        $checker = PermissionChecker::forUser(request());

        $panels = [];
        foreach ($expectedPanels as $referenceType => $expected) {
            $panels[] = $this->buildPanel(
                $document,
                $referenceType,
                $expected,
                $connections->get($referenceType, collect()),
                $checker,
            );
        }

        return $panels;
    }

    /**
     * @return Collection<int, ModelConnection>
     */
    private function loadConnections(Model $document): Collection {
        if ($document->getKey() === null) {
            return collect();
        }

        return ModelConnection::search($document::class, $document->getKey())->get();
    }

    /**
     * @param  array{action?: array{route: string, params?: array<string, mixed>, label: string, permission?: string}|null, remainder?: array{title?: string, columns?: array<int, array<string, mixed>>, rows?: string}}  $expected
     * @param  Collection<int, ModelConnection>  $connections
     */
    private function buildPanel(
        Model $document,
        string $referenceType,
        array $expected,
        Collection $connections,
        PermissionChecker $checker,
    ): array {
        $model      = new $referenceType;
        $definition = $referenceType::relationPanel();
        $detail     = $referenceType::relationPanelDetail();
        $hasDetail  = $detail !== [];
        $columns    = $definition['columns'] ?? [];

        $eager = array_values(array_unique([...($definition['eager'] ?? []), ...($detail['eager'] ?? [])]));

        // `source` menyebut method pada dokumen sumber yang mengembalikan query
        // builder. Hasilnya tetap lewat loadRecords(), jadi penjagaan berlaku.
        if (isset($expected['source'])) {
            $records = $this->loadRecords($model, $this->sourceQuery($document, $expected['source']), $eager, $checker);
        } else {
            $ids     = $connections->pluck('reference_id')->unique()->values()->all();
            $records = $ids === []
                ? collect()
                : $this->loadRecords($model, $model->newQuery()->whereKey($ids), $eager, $checker);
        }

        $rows = $records
            ->map(function (Model $record) use ($hasDetail): array {
                $row = ['id' => $record->getKey()] + $record->relationPanelRow();
                if ($hasDetail) {
                    $row['detail_rows'] = $record->relationPanelDetailRows();
                }

                return $row;
            })
            ->values()
            ->all();

        // aggregate_key memisahkan nilai yang DIJUMLAHKAN dari nilai yang
        // DITAMPILKAN. Kolom uang menampilkan nilai mata uang transaksi, tetapi
        // baris total harus menjumlahkan nilai mata uang dasar: dua invoice pada
        // satu PO boleh beda currency_code, sehingga menjumlahkan nilai asalnya
        // menghasilkan angka yang tidak sebanding.
        $totals = [];
        foreach ($columns as $column) {
            if (($column['aggregate'] ?? null) === 'sum') {
                $totals[$column['key']] = collect($rows)->sum($column['aggregate_key'] ?? $column['key']);
            }
        }

        $panel = [
            'reference_type' => $referenceType,
            'title'          => $expected['title'] ?? $definition['title'] ?? '',
            'columns'        => $columns,
            'rows'           => $rows,
            'totals'         => $totals,
            'action'         => $this->resolveAction($expected['action'] ?? null, $referenceType, $document, $checker),
            'is_empty'       => $rows === [],
            'route'          => Str::plural($model->getNameClass()) . '.show',
        ];

        if ($hasDetail) {
            $panel['detail_columns'] = $detail['columns'] ?? [];
        }

        $remainder = $this->buildRemainder($document, $expected['remainder'] ?? null);
        if ($remainder !== null) {
            $panel['remainder'] = $remainder;
        }

        return $panel;
    }

    /**
     * Muat record tujuan dengan penjagaan yang sama seperti jalur controller.
     *
     * Baris panel adalah data dokumen lain, jadi tidak cukup mengandalkan hak
     * akses atas dokumen yang sedang dibuka. $model->newQuery() juga tidak
     * membawa penjagaan apa pun: DataTableScope::apply() kosong, dan filter
     * cabang, submitted_at, serta created_by_id hidup di dalam macro
     * dataTable() yang hanya jalan bila dipanggil langsung.
     *
     * Tiga lapis di bawah meniru jalur itu:
     * 1. tanpa permission read pada model tujuan, tidak ada baris sama sekali;
     * 2. permission hasil only_creator dibatasi ke dokumen buatan user sendiri;
     * 3. dokumen submitable yang belum disubmit hanya terlihat oleh pembuatnya,
     *    sama seperti guard di macro dataTable().
     *
     * Rincian per baris (relationPanelDetailRows) hanya dibaca dari record yang
     * lolos ketiga lapis ini, karena itu eager rincian digabung ke $eager.
     *
     * @param  Builder<Model>  $query  sudah dibatasi ke record tujuan (whereKey atau method source)
     * @param  array<int, string>  $eager
     * @return Collection<int, Model>
     */
    private function loadRecords(Model $model, Builder $query, array $eager, PermissionChecker $checker): Collection {
        $referenceType = $model::class;

        if (! $checker->can($referenceType, Permission::Read)) {
            return collect();
        }

        // Auth::user(), bukan request()->user(): di luar siklus HTTP (panggilan
        // service langsung, test) request() adalah instance kosong sehingga
        // user()-nya selalu null. Pola sama dengan HasBranch::bootHasBranch().
        $user = Auth::user();
        if ($user === null) {
            return collect();
        }

        $query->with($eager);

        if ($checker->isOnlyCreator($referenceType, Permission::Read)) {
            $query->where('created_by_id', $user->getKey());
        } elseif ($model->isSubmitable()) {
            $query->where(function (Builder $query) use ($user): void {
                $query->whereNotNull('submitted_at')
                    ->orWhere('created_by_id', $user->getKey());
            });
        }

        return $query->get();
    }

    /**
     * Ambil query builder dari method `source` pada dokumen. Method yang
     * mengembalikan relasi atau koleksi ditolak, karena keduanya akan melewati
     * penjagaan loadRecords().
     *
     * @return Builder<Model>
     */
    private function sourceQuery(Model $document, string $method): Builder {
        $query = $document->{$method}();

        if (! $query instanceof Builder) {
            throw new \LogicException(sprintf('Method source %s::%s() harus mengembalikan query builder.', $document::class, $method));
        }

        return $query;
    }

    /**
     * Blok sisa di bawah daftar dokumen. Barisnya diambil dari method pada dokumen
     * sumber yang disebut deklarasi, dan blok dilewati bila tidak ada sisa.
     *
     * @param  array{title?: string, columns?: array<int, array<string, mixed>>, rows?: string}|null  $remainder
     * @return array{title: string, columns: array<int, array<string, mixed>>, rows: array<int, array<string, mixed>>}|null
     */
    private function buildRemainder(Model $document, ?array $remainder): ?array {
        if ($remainder === null || ! isset($remainder['rows'])) {
            return null;
        }

        $rows = $document->{$remainder['rows']}();
        if ($rows === []) {
            return null;
        }

        return [
            'title'   => $remainder['title'] ?? '',
            'columns' => $remainder['columns'] ?? [],
            'rows'    => $rows,
        ];
    }

    /**
     * @param  array{route: string, params?: array<string, mixed>, label: string, permission?: string}|null  $action
     * @return array{url: string, label: string}|null
     */
    private function resolveAction(?array $action, string $referenceType, Model $document, PermissionChecker $checker): ?array {
        if ($action === null) {
            return null;
        }

        // Permission yang tidak dikenal ditolak (fail closed), bukan dilewati.
        if (isset($action['permission'])) {
            $permission = Permission::tryFrom($action['permission']);
            if ($permission === null || ! $checker->can($referenceType, $permission)) {
                return null;
            }
        }

        $params = array_map(
            fn (mixed $value): mixed => is_string($value)
                ? str_replace('{id}', (string) $document->getKey(), $value)
                : $value,
            $action['params'] ?? [],
        );

        return [
            'url'   => route($action['route'], $params),
            'label' => $action['label'],
        ];
    }
}
