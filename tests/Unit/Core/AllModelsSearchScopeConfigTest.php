<?php

namespace Tests\Unit\Core;

use App\Models\Scopes\DataTableScope;
use App\Services\Core\DataTableConfigCache;
use App\Services\Core\FilterEvaluator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Pengaman config `$searchScope` di SEMUA model (spec datatable2-advanced-search,
 * Requirement 5).
 *
 * DataTableScope::sanitizeSearchScope() diam-diam membuang entri yang tidak
 * ter-resolve / tidak searchable / bukan string -- aman di runtime, tapi
 * developer tak pernah tahu entrinya sia-sia (chip "Cari" diam-diam tidak
 * mencari di kolom itu, mis. setelah kolom/relasi di-rename). Test ini menyapu
 * semua model dan MEMBUAT entri keliru gagal di CI, plus menjalankan tree
 * chip "Cari" (grup OR `matches`) lewat FilterEvaluator agar path relasi
 * (whereHas) terbukti menghasilkan SQL valid.
 *
 * setUp() meniru AllModelsGroupableConfigTest: kolom runtime baru ada setelah
 * initPermissions().
 */
class AllModelsSearchScopeConfigTest extends TestCase {
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
    public function every_search_scope_entry_survives_sanitization_and_runs_as_query(): void {
        $scope    = new DataTableScope;
        $sanitize = new ReflectionMethod($scope, 'sanitizeSearchScope');

        $failures = [];
        $checked  = 0;

        foreach (DataTableConfigCache::discoverLinkModels() as $modelClass) {
            if (! method_exists($modelClass, 'getSearchScope')) {
                continue;
            }
            $searchScope = $modelClass::getSearchScope();
            if ($searchScope === []) {
                continue;
            }

            $columns   = $modelClass::getColumns(1);
            $sanitized = $sanitize->invoke($scope, $searchScope, $columns);

            foreach (\array_diff($searchScope, $sanitized) as $dropped) {
                $failures[] = "{$modelClass}::\$searchScope '{$dropped}': dibuang sanitasi (tidak ter-resolve / searchable:false / bukan string).";
            }
            $checked += \count($sanitized);

            // Tree persis seperti yang dibangun FE (searchChips.addSearchChip).
            $children = [];
            foreach ($sanitized as $i => $column) {
                $children["s{$i}"] = ['k' => $column, 'o' => 'matches', 'v' => 'abc'];
            }
            $tree = ['root' => ['k' => 'and', 'c' => ['search' => ['k' => 'or', 'c' => $children]]]];

            try {
                $query = $modelClass::query();
                (new FilterEvaluator($columns))->apply($query, $tree);
                $query->count();
            } catch (\Throwable $e) {
                $failures[] = "{$modelClass}: tree chip Cari gagal dieksekusi -- {$e->getMessage()}";
            }
        }

        $this->assertGreaterThan(0, $checked, 'Minimal satu model harus mendeklarasikan $searchScope.');
        $this->assertSame([], $failures, \implode(PHP_EOL, $failures));
    }
}
