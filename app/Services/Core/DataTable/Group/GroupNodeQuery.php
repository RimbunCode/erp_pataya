<?php

namespace App\Services\Core\DataTable\Group;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Satu NODE pada pohon grup DataTable2 (spec datatable2-group-tree, Requirement
 * 5-6, 8): daftar grup satu level (`groups()`) atau baris daun (`rows()`).
 * Tidak pernah memuat semua baris sekaligus -- level dalam baru di-query saat
 * FE membuka grup induknya.
 *
 * `$query` HARUS query macro dataTable() SETELAH seluruh constraint ter-apply
 * (branch scope, saved filter, searchScope, submitable, scope kustom
 * controller) -- titik yang sama dgn `clone $query` lama -- sehingga node
 * memakai constraint yang IDENTIK dgn jalur flat (Property 3).
 *
 * `$path` = nilai `raw` grup leluhur dari level-0 ke bawah, di-BIND sebagai
 * parameter SQL (tak pernah diinterpolasi). Kolom SELALU berasal dari config
 * tervalidasi (ResolvedGroupLevel), bukan dari request.
 */
class GroupNodeQuery {
    /**
     * @param  list<ResolvedGroupLevel>  $levels
     * @param  list<array{column: string, fn: string, sqlColumn: string}>  $aggregates  sudah tersanitasi (GroupColumnGate)
     * @param  Closure(list<mixed>): Collection<int|string, Model>|null  $loadSamples  memuat model sampel (relasi ter-eager-load) per PK, di-key PK -- utk label grup relasi
     * @param  string|null  $sortAggregate  nama kolom agregat yang sedang jadi sort tabel (`?sort=`) -> baris grup ikut diurutkan menurut agregat itu; null = tak ada
     * @param  string  $sortDirection  arah sort tabel ('asc'|'desc'), dipakai bila `$sortAggregate` terisi
     * @param  string  $keyDirection  arah urutan grup menurut kunci/nilai grup ('asc'|'desc', param `groupSort`) -- urutan sekunder setelah agregat; TIDAK mengubah sort tabel
     */
    public function __construct(
        private Builder $query,
        private array $levels,
        private int $show,
        private array $aggregates = [],
        private ?Closure $loadSamples = null,
        private ?string $sortAggregate = null,
        private string $sortDirection = 'asc',
        private string $keyDirection = 'asc',
    ) {}

    /**
     * Daftar grup pada level `count($path)` di bawah node `$path`. Urutan: (1)
     * agregat yang jadi sort tabel bila ada, lalu (2) kunci grup menurut
     * `$keyDirection` (NULL paling awal saat asc). Kunci selalu jadi pemutus
     * seri sehingga halaman stabil.
     *
     * @param  list<mixed>  $path
     */
    public function groups(array $path, int $page): LengthAwarePaginator {
        $level   = $this->levels[\count($path)];
        $grouped = $this->groupedQuery($path, $level);

        $ordered = clone $grouped;
        $this->applyGroupOrder($ordered);
        $rows = $ordered->forPage($page, $this->show)->toBase()->get();

        // Total grup dilewati bila halaman 1 & hasil < show (total = jumlah
        // hasil) -- hemat 1 query utk mayoritas node.
        $total = $page === 1 && $rows->count() < $this->show
            ? $rows->count()
            : $this->countGroups($grouped);

        return new LengthAwarePaginator($this->descriptors($rows, $level), $total, $this->show, $page);
    }

    /**
     * Baris daun: `$path` sudah menyebut nilai SEMUA level. Sort user tetap
     * satu-satunya ORDER BY (sudah ada di `$query`); adaptive select & `with()`
     * macro dipakai apa adanya.
     *
     * @param  list<mixed>  $path
     */
    public function rows(array $path, int $page): LengthAwarePaginator {
        $q = clone $this->query;
        $this->applyPath($q, $path);

        // Sama pola dgn groups(): fetch dulu, count(*) HANYA kalau perlu.
        // Halaman 1 & hasil < show -> total = jumlah hasil (hemat 1 query) --
        // umum utk node daun kecil yang muat 1 halaman. Halaman > 1 tetap
        // query count sungguhan (hasil < show TAK cukup utk simpulkan total
        // tanpa memverifikasi apakah halaman-halaman sebelumnya benar penuh).
        $rows = (clone $q)->forPage($page, $this->show)->get();

        $total = $page === 1 && $rows->count() < $this->show
            ? $rows->count()
            : $q->toBase()->getCountForPagination();

        return new LengthAwarePaginator($rows, $total, $this->show, $page);
    }

    /**
     * SELECT key + count (+ sample id utk relasi, + agregat) atas baris di bawah
     * `$path`, GROUP BY key. Tanpa ORDER BY/LIMIT (dipasang pemanggil).
     *
     * @param  list<mixed>  $path
     */
    private function groupedQuery(array $path, ResolvedGroupLevel $level): Builder {
        $q      = clone $this->query;
        $base   = $q->getQuery();
        $wrap   = fn (string $column) => $base->getGrammar()->wrap($column);
        $table  = $base->from;
        $pkName = $q->getModel()->getKeyName();

        // Reset select/order: `->orders = []` cuma membersihkan teks klausa,
        // BUKAN bindings-nya (array terpisah di QueryBuilder) -- bindings 'order'
        // yg nyangkut bikin jumlah binding > jumlah `?` di SQL akhir (PDO "column
        // index out of range"). selectRaw APPEND, bukan REPLACE spt select(),
        // makanya columns di-null-kan dulu.
        $base->orders             = [];
        $base->columns            = null;
        $base->bindings['order']  = [];
        $base->bindings['select'] = [];
        $q->setEagerLoads([]);

        $this->applyPath($q, $path);

        // Alias tetap "group_key" baik plain column maupun bucket (granularity
        // date / range number) -- satu bentuk pembacaan hasil query.
        if ($level->bucket) {
            $q->selectRaw("{$level->bucket[0]} as group_key", $level->bucket[1]);
        } else {
            $q->selectRaw($wrap($level->qualified) . ' as group_key');
        }
        $q->selectRaw('COUNT(*) as aggregate_count');
        if ($level->isRelation()) {
            $q->selectRaw('MIN(' . $wrap("$table.$pkName") . ') as sample_id');
        }
        foreach ($this->aggregates as $index => $aggregate) {
            $column = $wrap("$table.{$aggregate['sqlColumn']}");
            match ($aggregate['fn']) {
                'sum' => $q->selectRaw("SUM($column) as agg_{$index}"),
                'min' => $q->selectRaw("MIN($column) as agg_{$index}"),
                'max' => $q->selectRaw("MAX($column) as agg_{$index}"),
                // AVG dihitung di PHP dari SUM & COUNT(kolom): benar saat 2 baris
                // SQL digabung jadi 1 grup (varian teks formStatuses), dan tak
                // bergantung pada tipe hasil AVG per driver.
                'avg'   => $q->selectRaw("SUM($column) as agg_{$index}_sum")->selectRaw("COUNT($column) as agg_{$index}_cnt"),
                default => null,
            };
        }

        // Bucket: GROUP BY alias, JANGAN ulangi ekspresinya. Ekspresi number
        // berisi placeholder (`floor(x / ?) * ?`) -- di MySQL (prepared statement
        // native + ONLY_FULL_GROUP_BY) salinan di SELECT dan di GROUP BY dianggap
        // ekspresi BERBEDA krn tiap `?` berdiri sendiri -> error 1055. Alias juga
        // menghapus binding ganda. Valid di sqlite & mysql.
        $q->groupBy($level->bucket ? 'group_key' : $level->qualified);

        return $q;
    }

    /**
     * ORDER BY daftar grup: agregat sort-tabel (SUM/MIN/MAX langsung; AVG =
     * SUM/COUNT dgn `1.0 *` agar SQLite tak membulatkan integer) lalu
     * `group_key`. Ekspresi agregat ditulis ulang (bukan alias) supaya valid di
     * MySQL ONLY_FULL_GROUP_BY & SQLite.
     */
    private function applyGroupOrder(Builder $q): void {
        $aggregate = $this->sortAggregate === null
            ? null
            : \collect($this->aggregates)->firstWhere('column', $this->sortAggregate);

        if ($aggregate !== null) {
            $base       = $q->getQuery();
            $column     = $base->getGrammar()->wrap("{$base->from}.{$aggregate['sqlColumn']}");
            $direction  = $this->sortDirection === 'desc' ? 'desc' : 'asc';
            $expression = match ($aggregate['fn']) {
                'sum'   => "SUM($column)",
                'min'   => "MIN($column)",
                'max'   => "MAX($column)",
                'avg'   => "1.0 * SUM($column) / NULLIF(COUNT($column), 0)",
                default => null,
            };
            if ($expression !== null) {
                $q->orderByRaw("$expression $direction");
            }
        }

        $q->orderBy('group_key', $this->keyDirection === 'desc' ? 'desc' : 'asc');
    }

    /** Jumlah grup (total halaman node) = COUNT(*) atas subquery yang sama. */
    private function countGroups(Builder $grouped): int {
        return (int) $this->query->getQuery()->newQuery()
            ->fromSub($grouped->toBase(), 'g')
            ->count();
    }

    /**
     * Predikat WHERE utk tiap nilai pada `$path` (level ke-i dari `$levels`).
     * Semua nilai di-bind. `raw` null = grup NULL -> `IS NULL` utk SEMUA tipe
     * (termasuk bucket: kolom NULL -> ekspresi bucket NULL).
     *
     * @param  list<mixed>  $path
     */
    private function applyPath(Builder $q, array $path): void {
        $grammar = $q->getQuery()->getGrammar();

        foreach ($path as $index => $raw) {
            $level  = $this->levels[$index];
            $column = $level->qualified;

            if ($raw === null) {
                $q->whereNull($column);

                continue;
            }

            switch (true) {
                case $level->type === 'formStatuses':
                    // `raw` = daftar varian teks mentah yg menormalisasi ke key sama.
                    // CAST(.. AS CHAR): portabel SQLite/MySQL/MariaDB (sisi SELECT
                    // menerima serialisasi teks dari mesin yang sama).
                    $variants = \array_values((array) $raw);
                    $q->whereRaw(
                        'CAST(' . $grammar->wrap($column) . ' AS CHAR) in (' . \implode(', ', \array_fill(0, \count($variants), '?')) . ')',
                        $variants,
                    );

                    break;
                case $level->type === 'boolean':
                    $q->where($column, (int) $raw);

                    break;
                case \in_array($level->type, ['date', 'time', 'datetime'], true):
                    $q->whereRaw($level->bucket[0] . ' = ?', [...$level->bucket[1], $raw]);

                    break;
                case \in_array($level->type, ['number', 'currency'], true):
                    // Rentang [lower, lower+range) -- bukan `floor(col/r)*r = ?`:
                    // aman utk range pecahan (kesamaan float rawan meleset) &
                    // sargable (index kolom terpakai).
                    $lower = $raw + 0;
                    $q->where($column, '>=', $lower)->where($column, '<', $lower + ($level->range ?? 0));

                    break;
                default:
                    $q->where($column, $raw);
            }
        }
    }

    /**
     * Baris SQL hasil group -> deskriptor grup `{key, raw, count, aggregates,
     * label?}`. Baris SQL yg key-nya SAMA (varian teks formStatuses) dijumlahkan
     * jadi satu grup, `raw` menampung semua variannya.
     *
     * @param  Collection<int, \stdClass>  $rows
     * @return list<array<string, mixed>>
     */
    private function descriptors(Collection $rows, ResolvedGroupLevel $level): array {
        $isStatuses = $level->type === 'formStatuses';
        $isNumber   = \in_array($level->type, ['number', 'currency'], true);
        $groups     = [];

        foreach ($rows as $row) {
            $rawValue = $row->group_key;
            $key      = GroupKeyNormalizer::key($rawValue, $level->type);

            if (! isset($groups[$key])) {
                $groups[$key] = ['key' => $key, 'raw' => null, 'count' => 0, 'sample' => null, 'acc' => []];
            }
            $group = &$groups[$key];

            if ($isStatuses) {
                if ($rawValue !== null) {
                    $group['raw'] = [...($group['raw'] ?? []), $rawValue];
                }
            } else {
                $group['raw'] = $isNumber && \is_string($rawValue) && \is_numeric($rawValue) ? $rawValue + 0 : $rawValue;
            }
            $group['count'] += (int) $row->aggregate_count;
            $group['sample'] ??= $row->sample_id ?? null;

            foreach ($this->aggregates as $index => $aggregate) {
                $this->accumulate($group['acc'][$index], $aggregate['fn'], $row, $index);
            }
            unset($group);
        }

        $samples = $level->isRelation() && $this->loadSamples
            ? ($this->loadSamples)(\array_values(\array_filter(\array_column($groups, 'sample'), fn ($id) => $id !== null)))
            : collect();

        return \array_values(\array_map(function (array $group) use ($level, $samples) {
            $descriptor = [
                'key'        => $group['key'],
                'raw'        => $group['raw'],
                'count'      => $group['count'],
                'aggregates' => $this->finalizeAggregates($group['acc']),
            ];
            if ($level->isRelation()) {
                $sample = $group['sample'] !== null ? $samples->get($group['sample']) : null;
                // Relasi morph (`groupMorph`): label MINIMAL pemilik, bukan seluruh
                // baris model target (kolom sensitif) -- dan TANPA `toArray()` induk
                // (menyerialisasi model target penuh beserta `$appends`-nya).
                $label = match (true) {
                    $sample === null                      => null,
                    $level->config['groupMorph'] ?? false => GroupLabelResolver::morphLabel($sample->getRelationValue($level->column)),
                    default                               => $sample->toArray()[$level->column] ?? null,
                };
                // Grup NULL: label bawaan dari config kolom (mis. nama perusahaan).
                if ($group['key'] === 'null') {
                    $label = GroupLabelResolver::nullLabel($level->config) ?? $label;
                }
                $descriptor['label'] = $label;
            }

            return $descriptor;
        }, $groups));
    }

    /**
     * Kumpulkan satu agregat dari satu baris SQL ke akumulator grup (baris SQL
     * ganda per grup hanya terjadi utk varian teks formStatuses).
     *
     * @param  array<string, mixed>|null  $acc
     */
    private function accumulate(?array &$acc, string $fn, \stdClass $row, int $index): void {
        $acc ??= ['fn' => $fn, 'sum' => null, 'cnt' => 0, 'min' => null, 'max' => null];

        if ($fn === 'avg') {
            $sum = $row->{"agg_{$index}_sum"} ?? null;
            if ($sum !== null) {
                $acc['sum'] = ($acc['sum'] ?? 0) + $sum;
            }
            $acc['cnt'] += (int) ($row->{"agg_{$index}_cnt"} ?? 0);

            return;
        }

        $value = $row->{"agg_{$index}"} ?? null;
        if ($value === null) {
            return;
        }
        match ($fn) {
            'sum'   => $acc['sum'] = ($acc['sum'] ?? 0) + $value,
            'min'   => $acc['min'] = $acc['min'] === null ? $value : \min($acc['min'], $value),
            'max'   => $acc['max'] = $acc['max'] === null ? $value : \max($acc['max'], $value),
            default => null,
        };
    }

    /**
     * @param  array<int, array<string, mixed>>  $acc
     * @return array<string, int|float|null>
     */
    private function finalizeAggregates(array $acc): array {
        $result = [];
        foreach ($this->aggregates as $index => $aggregate) {
            $state = $acc[$index] ?? null;
            $value = match ($aggregate['fn']) {
                'avg'   => $state && $state['cnt'] > 0 ? $state['sum'] / $state['cnt'] : null,
                'sum'   => $state['sum'] ?? null,
                'min'   => $state['min'] ?? null,
                'max'   => $state['max'] ?? null,
                default => null,
            };
            $result[$aggregate['column']] = \is_string($value) && \is_numeric($value) ? $value + 0 : $value;
        }

        return $result;
    }
}
