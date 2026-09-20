<?php

namespace Tests\Unit\Core;

use App\Models\Scopes\DataTableScope;
use App\Services\Core\DataTableConfigCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Pengaman config `groupable` di SEMUA model (baik dari $configColumns model
 * maupun dari defaultConfigColumns LinkModel, mis. `status`/`branch`/`createdBy`).
 *
 * DataTableScope::sanitizeGroupableColumns() diam-diam memaksa `groupable`
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
        $scope     = new DataTableScope;
        $sanitize  = new ReflectionMethod($scope, 'sanitizeGroupableColumns');
        $resolveFk = new ReflectionMethod($scope, 'resolveRelationGroupColumn');

        $failures = [];
        $checked  = 0;

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            $model     = new $modelClass;
            $columns   = $modelClass::getColumns(1);
            $sanitized = $sanitize->invoke($scope, $columns, $model);

            foreach ($columns as $key => $column) {
                if (! ($column['groupable'] ?? false)) {
                    continue;
                }
                $checked++;
                $name = $column['name'] ?? (string) $key;

                if (! ($sanitized[$key]['groupable'] ?? false)) {
                    $failures[] = "{$modelClass}.{$name}: groupable:true tapi ditolak DataTableScope (tipe tak didukung / relasi bukan BelongsTo / kolom turunan). Hapus flag-nya atau set groupable:false.";

                    continue;
                }

                $physical = ($column['type'] ?? null) === 'relation'
                    ? $resolveFk->invoke($scope, $model, $column)
                    : $name;

                if (! Schema::hasColumn($model->getTable(), (string) $physical)) {
                    $failures[] = "{$modelClass}.{$name}: kolom fisik '{$physical}' tidak ada di tabel '{$model->getTable()}' -- GROUP BY akan SQL error.";
                }
            }
        }

        $this->assertGreaterThan(0, $checked, 'Tak ada satupun kolom groupable ditemukan -- test ini kemungkinan rusak.');
        $this->assertEmpty($failures, "Config groupable keliru:\n" . implode("\n", $failures));
    }
}
