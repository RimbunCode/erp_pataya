<?php

namespace Tests\Unit\Core;

use App\Models\User\User;
use App\Services\Core\DataTable\Group\GroupColumnGate;
use App\Services\Core\DataTableConfigCache;
use App\Traits\DataTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Pengaman config `groupable` di SEMUA model (baik dari $configColumns model
 * maupun dari defaultConfigColumns LinkModel, mis. `status`/`branch`/`createdBy`).
 *
 * GroupColumnGate::sanitizeColumns() diam-diam memaksa `groupable`
 * jadi false utk kolom yg tak bisa di-GROUP BY (tipe json/mixed/relations/html,
 * relasi bukan BelongsTo, kolom turunan/accessor) -- aman di runtime tapi
 * developer tak pernah tahu config-nya sia-sia (dropdown "Group by" cuma tak
 * memuat kolom itu). Test ini menyapu semua model dan MEMBUAT config keliru
 * itu gagal di CI, plus memastikan kolom fisik (atau FK relasi) benar-benar
 * ada di tabel -- kalau tidak, GROUP BY/ORDER BY meledak jadi SQL error.
 *
 * setUp() meniru AllModelsDataTableConfigValidatorTest: kolom runtime
 * (`status`, `branch_id`, `created_by_id`, ...) baru ada setelah
 * initPermissions().
 */
class AllModelsGroupableConfigTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            if (! method_exists($modelClass, 'initPermissions')) {
                continue;
            }

            try {
                $modelClass::initPermissions();
            } catch (\Throwable) {
                // Bug index tree-view SQLite yg sudah didokumentasikan di
                // AllModelsDataTableConfigValidatorTest -- kolom relevan sudah ke-ADD.
            }
        }
    }

    #[Test]
    public function every_groupable_column_is_actually_groupable(): void {
        $failures = [];
        $checked  = 0;

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            $model     = new $modelClass;
            $columns   = $modelClass::getColumns(1);
            $sanitized = GroupColumnGate::sanitizeColumns($columns, $model);

            foreach ($columns as $key => $column) {
                if (! ($column['groupable'] ?? false)) {
                    continue;
                }
                $checked++;
                $name = $column['name'] ?? (string) $key;

                if (! ($sanitized[$key]['groupable'] ?? false)) {
                    $failures[] = "{$modelClass}.{$name}: groupable:true tapi ditolak GroupColumnGate (tipe tak didukung / relasi bukan BelongsTo / kolom turunan). Hapus flag-nya atau set groupable:false.";

                    continue;
                }

                $physical = ($column['type'] ?? null) === 'relation'
                    ? GroupColumnGate::relationSqlColumn($model, $column)
                    : $name;

                if (! Schema::hasColumn($model->getTable(), (string) $physical)) {
                    $failures[] = "{$modelClass}.{$name}: kolom fisik '{$physical}' tidak ada di tabel '{$model->getTable()}' -- GROUP BY akan SQL error.";
                }
            }
        }

        $this->assertGreaterThan(0, $checked, 'Tak ada satupun kolom groupable ditemukan -- test ini kemungkinan rusak.');
        $this->assertEmpty($failures, "Config groupable keliru:\n" . implode("\n", $failures));
    }

    #[Test]
    public function every_groupable_column_executes_its_group_query(): void {
        // Tabel kosong cukup: yg diuji adalah SQL-nya (SELECT/GROUP BY/ORDER BY
        // + count query) -- kolom yg salah nama / bukan kolom SQL langsung
        // meledak QueryException, bukan cuma "tak ada data".
        $user = User::factory()->create();
        $this->actingAs($user);

        $failures = [];
        $ran      = 0;

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            // Macro dataTable() hanya didukung model ber-trait DataTable (butuh
            // getDefaultSortColumn(), dst) -- model LinkModel murni (child/pivot)
            // tak pernah dipanggil lewat macro ini.
            if (! \in_array(DataTable::class, class_uses_recursive($modelClass), true)) {
                continue;
            }

            foreach ($modelClass::getColumns(1) as $column) {
                if (! ($column['groupable'] ?? false)) {
                    continue;
                }

                $request = Request::create('/x', 'GET', ['group' => $column['name']]);
                $request->setUserResolver(fn () => $user);
                Inertia::share('groupMeta', 'belum-diisi');

                try {
                    $modelClass::dataTable($request);
                    // Kontrak baru (spec datatable2-group-tree): request level-0
                    // menghasilkan `groupMeta` (array) + `data` berisi DESKRIPTOR grup.
                    $meta = Inertia::getShared('groupMeta');
                    if (! \is_array($meta) || ($meta['levels'][0]['column'] ?? null) !== $column['name']) {
                        $failures[] = "{$modelClass}.{$column['name']}: groupMeta tak berisi level ini (grup ditolak/tidak dihitung).";
                    } elseif (! Inertia::getShared('data') instanceof LengthAwarePaginator) {
                        $failures[] = "{$modelClass}.{$column['name']}: data level-0 bukan paginator daftar grup.";
                    }
                } catch (\Throwable $e) {
                    $failures[] = "{$modelClass}.{$column['name']}: " . class_basename($e) . ': ' . \substr($e->getMessage(), 0, 200);
                }
                $ran++;
            }
        }

        $this->assertGreaterThan(0, $ran, 'Tak ada satupun kolom groupable dijalankan -- test ini kemungkinan rusak.');
        $this->assertEmpty($failures, "Query grup gagal utk kolom berikut:\n" . implode("\n", $failures));
    }

    /**
     * Request EXPAND (`groupPath`) utk tiap kolom groupable -- node daun
     * (`whereNull` pada kolom grup itu) dan, bila model punya >= 2 kolom
     * groupable, node daftar-sub-grup (2 level). Tabel kosong cukup: yg diuji
     * adalah VALIDITAS SQL predikat path + GROUP BY per model/tipe kolom;
     * kolom/tipe yg salah meledak QueryException, bukan sekadar "tak ada data".
     */
    #[Test]
    public function every_groupable_column_executes_its_expand_queries(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $failures = [];
        $ran      = 0;

        $expand = function (string $modelClass, array $query) use ($user): array {
            $request = Request::create('/x', 'GET', $query, server: ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
            $request->setUserResolver(fn () => $user);

            try {
                $modelClass::dataTable($request);
            } catch (HttpResponseException $e) {
                return [$e->getResponse()->getStatusCode(), $e->getResponse()->getData(true)];
            }

            return [0, []];
        };

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            if (! \in_array(DataTable::class, class_uses_recursive($modelClass), true)) {
                continue;
            }

            $groupable = \array_values(\array_filter(
                \array_map(fn ($c) => $c['name'] ?? null, \array_filter($modelClass::getColumns(1), fn ($c) => $c['groupable'] ?? false)),
            ));

            foreach ($groupable as $index => $name) {
                $cases = ["{$name} -> daun" => ['group' => $name, 'groupPath' => json_encode([null])]];
                if (isset($groupable[$index + 1])) {
                    $cases["{$name},{$groupable[$index + 1]} -> sub-grup"] = [
                        'group'     => "{$name},{$groupable[$index + 1]}",
                        'groupPath' => json_encode([null]),
                    ];
                }

                foreach ($cases as $label => $query) {
                    try {
                        [$status, $payload] = $expand($modelClass, $query);
                        if ($status !== 200 || ! isset($payload['type'])) {
                            $failures[] = "{$modelClass} [{$label}]: status {$status} " . json_encode($payload['errors'] ?? $payload['message'] ?? '');
                        }
                    } catch (\Throwable $e) {
                        $failures[] = "{$modelClass} [{$label}]: " . class_basename($e) . ': ' . \substr($e->getMessage(), 0, 200);
                    }
                    $ran++;
                }
            }
        }

        $this->assertGreaterThan(0, $ran, 'Tak ada satupun request expand dijalankan -- test ini kemungkinan rusak.');
        $this->assertEmpty($failures, "Request expand gagal:\n" . implode("\n", $failures));
    }

    /**
     * Guard `groupAggregate` (spec datatable2-group-tree, Requirement 9.2):
     * konfigurasi keliru DIABAIKAN diam-diam di runtime (aman), jadi developer
     * tak pernah tahu config-nya sia-sia -- test ini membuatnya GAGAL di CI,
     * plus memastikan kolomnya benar-benar ada di tabel (kalau tidak,
     * SUM/AVG/MIN/MAX meledak jadi SQL error). Baru bermakna begitu ada model
     * yang mendeklarasikan `groupAggregate` (belum ada = lolos tanpa periksa).
     */
    #[Test]
    public function every_declared_group_aggregate_is_valid_and_physical(): void {
        $failures = [];

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            $model     = new $modelClass;
            $columns   = $modelClass::getColumns(1);
            $sanitized = collect(GroupColumnGate::aggregates($columns))->pluck('column')->all();

            foreach ($columns as $key => $column) {
                if (! isset($column['groupAggregate'])) {
                    continue;
                }
                $name = $column['name'] ?? (string) $key;

                if (! \in_array($name, $sanitized, true)) {
                    $failures[] = "{$modelClass}.{$name}: groupAggregate '" . json_encode($column['groupAggregate']) . "' ditolak GroupColumnGate (fungsi harus sum|avg|min|max, tipe number|currency, kolom SQL riil bukan turunan).";

                    continue;
                }
                if (! Schema::hasColumn($model->getTable(), $name)) {
                    $failures[] = "{$modelClass}.{$name}: kolom fisik tidak ada di tabel '{$model->getTable()}' -- agregat akan SQL error.";
                }
            }
        }

        $this->assertEmpty($failures, "Config groupAggregate keliru:\n" . implode("\n", $failures));
    }
}
