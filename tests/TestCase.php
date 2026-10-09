<?php

namespace Tests;

use App\Models\Scopes\DataTableScope;
use App\Services\Core\BranchScopeCache;
use App\Services\Core\SchemaColumnCache;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase {
    protected function setUp(): void {
        parent::setUp();

        // SchemaColumnCache (statis, per proses PHP -- PHPUnit menjalankan
        // SEMUA test method dalam SATU proses) HARUS bersih di awal tiap
        // test, SEBELUM setUp() milik child (mis. DataTableScopeGroupingTest)
        // sempat menambah kolom via Schema::table(...)->addColumn(...) --
        // kalau tidak, cache basi dari test method/class LAIN (skema tabel
        // sebelum kolom ditambah) bisa nyangkut & bikin hasil salah.
        SchemaColumnCache::forget();

        // Sama alasannya dengan SchemaColumnCache di atas -- DataTableScope
        // meng-cache status is_main_branch per id Branch statis per proses.
        // RefreshDatabase reset DB tiap test, jadi id Branch dari test SEBELUMNYA
        // bisa nyangkut & memberi hasil salah kalau tak direset.
        DataTableScope::forgetBranchMainStatusCache();

        // Sama alasan lagi -- HasBranch::bootHasBranch() (scope 'branch') cache
        // afiliasi main-branch per user id + id Branch per session('currentBranch')
        // lewat BranchScopeCache, statis per proses.
        BranchScopeCache::forget();
    }
}
