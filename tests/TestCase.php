<?php

namespace Tests;

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
    }
}
