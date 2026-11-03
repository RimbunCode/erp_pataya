<?php

namespace Tests;

use App\Models\Scopes\DataTableScope;
use App\Services\Core\BranchScopeCache;
use App\Services\Core\DataTableConfigCache;
use App\Services\Core\SchemaColumnCache;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use ReflectionProperty;

abstract class TestCase extends BaseTestCase {
    protected bool $dropViews = true;

    /**
     * Eloquent men-cache daftar kolom tabel per kelas model di
     * Model::$guardableColumns (statis, per proses PHP, tidak pernah
     * dibersihkan) untuk model ber-`$guarded`; fill()/update() membuang diam-diam
     * kolom yang tidak ada di daftar itu. Worker paratest `--functional` dipakai
     * ulang antar test, jadi daftar basi bocor ke test berikutnya.
     *
     * Sumber kebocoran yang diketahui: enam berkas test yang membuat stub tabel
     * `print_templates` buatan tangan tanpa `page_number_format` dan tanpa
     * RefreshDatabase, lalu memakai modelnya:
     * ControllerPrintPreferencesDocInfoTest, EmailPreviewControllerTest,
     * PrintTemplate/PrintPdfControllerTest, PrintTemplateRequestTest,
     * PrintTemplateStoreRelationsTest, dan SendEmailWithPdfJobTest. Akibatnya
     * `$template->update(['page_number_format' => ...])` di
     * StandardPrintTemplateSeederTest gagal sporadis di CI. Seeder sendiri tidak
     * kena karena `db:seed` berjalan dalam Model::unguarded().
     */
    private static function forgetGuardableColumns(): void {
        (new ReflectionProperty(EloquentModel::class, 'guardableColumns'))->setValue(null, []);
    }

    protected function setUp(): void {
        // Sebelum parent::setUp(): daftar basi dari test sebelumnya masih aktif
        // selama migrasi RefreshDatabase dan bootstrap aplikasi.
        self::forgetGuardableColumns();

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

        // Memo flat() DataTableConfigCache, statis per proses: tanpa reset, konfigurasi
        // kolom dari test lain (skema/konfigurasi model berbeda) bisa nyangkut.
        DataTableConfigCache::forgetMemo();

        // Reset lagi setelah parent::setUp(): migrasi RefreshDatabase dan setUp trait
        // bisa memakai model ber-$guarded dan mengisi ulang cache.
        self::forgetGuardableColumns();

        // View laporan (modul-laporan) membaca tabel sumber. Di SQLite, ALTER TABLE yang
        // dipakai initPermissions() untuk menambah kolom runtime gagal bila view memakai
        // tabel itu ("no such table: main.sales_orders" saat rename). Mode legacy menonaktifkan
        // pemeriksaan view tersebut. Hanya berlaku untuk koneksi SQLite (tes).
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA legacy_alter_table = ON');
        }
    }
}
