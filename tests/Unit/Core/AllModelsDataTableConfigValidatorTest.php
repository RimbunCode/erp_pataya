<?php

namespace Tests\Unit\Core;

use App\Services\Core\DataTableConfigCache;
use App\Services\Core\DataTableConfigValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Regresi commit 20c9b6cb ("feat(models): add templateLink() to 49 non-pivot
 * models missing it") — templateLink() ditambahkan borongan ke 49 model tanpa
 * memastikan tiap token-nya resolvable lewat DataTableConfigValidator. Akibatnya
 * 16 dari 49 model lolos CI (tests/Unit/Core/DataTableConfigValidatorTest.php
 * yang sudah ada HANYA memvalidasi 2 model: Asset & AssetCategory) dan baru
 * ketahuan saat deploy staging/production menjalankan
 * `php artisan model:cache --strict` (lihat .scripts/deploy-staging.sh dan
 * .scripts/deploy-production.sh) — TEPAT SEBELUM langkah `ln -sfn` yang
 * menukar symlink rilis, sehingga deploy berhenti di tengah jalan.
 *
 * Test ini memindahkan gate tsb dari waktu-deploy ke waktu-CI: menyapu SEMUA
 * model yang memakai trait LinkModel (via
 * DataTableConfigCache::discoverLinkModels(), sumber daftar model yang sama
 * dipakai `php artisan model:cache`, lihat
 * app/Console/Commands/ModelCacheCommand.php) dan memastikan nol pelanggaran
 * validasi utk tiap model.
 *
 * Butuh scaffolding runtime: kolom spt `code`, `status`, `branch_id`,
 * `created_by_id`, `submitted_at`, `canceled_at` pada model submitable/
 * generateCodeSeries TIDAK dibuat lewat migrations statis -- kolom-kolom itu
 * ditambahkan lazy oleh DataTable::initPermissions() (app/Traits/DataTable.php)
 * saat model pertama kali "dikenalkan" ke sistem permission (di real DB hal
 * ini sudah terjadi via seeder/observer, jadi `php artisan model:cache
 * --strict` di dev/staging tidak pernah kelihatan masalah ini). Di sqlite
 * :memory: bersih hasil RefreshDatabase, kolom itu belum ada sama sekali --
 * tanpa initPermissions() test ini false-positive melaporkan puluhan model
 * submitable (SalesOrder, PurchaseOrder, dst) sebagai rusak padahal
 * konfigurasinya benar, cuma kolom runtime-nya belum di-provision. Maka
 * setUp() memanggil initPermissions() (kalau method-nya ada -- hanya model
 * yang pakai trait DataTable) utk tiap model SEBELUM validasi, meniru pola
 * PurchaseOrderCanUpdateScopeTest/EmailTemplateValidationTest tapi digeneralisir
 * ke SEMUA model hasil discoverLinkModels(), bukan cuma beberapa yang disebut
 * eksplisit di test lain.
 *
 * TEMUAN SAMPING (bukan scope perbaikan ini, sengaja di-catch bukan dibiarkan
 * meledak): cabang is_tree_view di initPermissions() memberi nama index
 * `lft_index`/`rgt_index`/`depth_index`/`idx_depth_lft`/`idx_parent_lft` yang
 * HARDCODED sama utk semua model (tidak di-prefix nama tabel). Di MySQL
 * (prod/staging) ini aman krn index scoped per-tabel, tapi SQLite
 * mem-perlakukan nama index sbg namespace GLOBAL satu database -- begitu
 * lebih dari satu model tree-view (Account, Supplier, File; AssetLocation
 * sudah bawa kolomnya dari migration jadi skip) diproses dlm proses test yang
 * sama, model ke-2/3 gagal kena "index lft_index already exists" walau
 * kolom lft/rgt/depth-nya sendiri sudah sempat ke-ADD (statement ADD COLUMN
 * jalan duluan sebelum statement index yang gagal). Tidak pernah ketahuan
 * sebelumnya krn tidak ada test yang memanggil initPermissions() utk semua
 * model tree-view dlm satu proses. Di luar scope task ini (dilarang mengubah
 * file selain 16 model + test baru) -- di-catch supaya scaffolding tetap bisa
 * jalan utk model lain; sinyal pass/fail sebenarnya tetap datang dari
 * assertion validate() di bawah, bukan dari sini.
 */
class AllModelsDataTableConfigValidatorTest extends TestCase {
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
                // Lihat docblock class: bug hardcoded index name tree-view,
                // di luar scope. Kolom yang relevan bagi validate() umumnya
                // sudah ter-ADD sebelum statement index yang gagal.
            }
        }
    }

    #[Test]
    public function all_link_models_pass_strict_config_validation(): void {
        $modelClasses = DataTableConfigCache::discoverLinkModels();

        $this->assertNotEmpty(
            $modelClasses,
            'discoverLinkModels() tidak menemukan model apapun -- kemungkinan test ini yang rusak/salah setup, bukan berarti codebase bersih.',
        );

        $failures = [];

        foreach ($modelClasses as $modelClass) {
            $violations = DataTableConfigValidator::validate($modelClass);

            foreach ($violations as $violation) {
                $column     = $violation['column'] ?? 'N/A';
                $rule       = $violation['rule'] ?? 'N/A';
                $message    = $violation['message'] ?? 'N/A';
                $failures[] = "{$modelClass} (Rule {$rule}, kolom: {$column}): {$message}";
            }
        }

        $this->assertEmpty(
            $failures,
            "Ditemukan pelanggaran konfigurasi DataTableConfigValidator (deploy akan gagal di `php artisan model:cache --strict`) pada model berikut:\n" . implode("\n", $failures),
        );
    }
}
