<?php

namespace Tests\Feature\Finances;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Finance Fase 2, Q-P2-23 (keputusan pemilik produk 2026-11-22, opsi A): migrasi
 * `drop_posting_modes_from_finance_settings_table` menghapus setting `posting_modes` karena mode `off`/`shadow` dihapus.
 * `up()` aman dijalankan ulang; `down()` memulihkan kolom dan mengisi `on` untuk semua jenis dokumen agar rilis
 * sebelumnya (yang membaca nilai kosong sebagai `off`) tetap dapat memposting.
 */
class DropPostingModesMigrationTest extends TestCase {
    use RefreshDatabase;

    private function migration(): Migration {
        $files = glob(database_path('migrations/*_drop_posting_modes_from_finance_settings_table.php'));
        $this->assertCount(1, $files);

        return require $files[0];
    }

    public function test_column_is_gone_after_migrating_and_the_singleton_row_can_be_created(): void {
        $this->assertFalse(Schema::hasColumn('finance_settings', 'posting_modes'));

        $setting = FinanceSetting::current();

        $this->assertNotNull($setting->getKey());
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::defaultAttributes());
        $this->assertSame(array_fill_keys(PostingDocumentType::values(), 'inline'), $setting->posting_executions, 'Setting eksekusi (D-1) tidak tersentuh.');
    }

    public function test_up_is_safe_to_run_again(): void {
        $migration = $this->migration();

        $migration->up();
        $migration->up();

        $this->assertFalse(Schema::hasColumn('finance_settings', 'posting_modes'));
        $this->assertTrue(Schema::hasColumn('finance_settings', 'posting_executions'));
    }

    public function test_down_restores_the_column_and_fills_every_document_type_with_on(): void {
        FinanceSetting::current();
        $migration = $this->migration();

        $migration->down();

        $this->assertTrue(Schema::hasColumn('finance_settings', 'posting_modes'));
        $stored = json_decode((string) DB::table('finance_settings')->value('posting_modes'), true);
        $this->assertSame(PostingDocumentType::values(), array_keys($stored));
        $this->assertSame(['on'], array_values(array_unique($stored)));

        // down() kedua tidak mengubah apa pun (kolom sudah ada).
        $migration->down();
        $this->assertSame($stored, json_decode((string) DB::table('finance_settings')->value('posting_modes'), true));

        $migration->up();
        $this->assertFalse(Schema::hasColumn('finance_settings', 'posting_modes'));
    }

    public function test_down_without_a_setting_row_only_adds_the_nullable_column(): void {
        $migration = $this->migration();
        $this->assertSame(0, DB::table('finance_settings')->count());

        $migration->down();

        $this->assertTrue(Schema::hasColumn('finance_settings', 'posting_modes'));
        $this->assertSame(0, DB::table('finance_settings')->count());
        $this->assertTrue((bool) collect(Schema::getColumns('finance_settings'))->firstWhere('name', 'posting_modes')['nullable']);
    }

    public function test_the_original_add_migration_still_matches_the_dropped_column_name(): void {
        $files = glob(database_path('migrations/*_add_posting_modes_to_finance_settings_table.php'));

        $this->assertCount(1, $files, 'Migrasi asal tetap ada sebagai riwayat; migrasi drop berjalan setelahnya.');
        $this->assertGreaterThan(basename($files[0]), basename(glob(database_path('migrations/*_drop_posting_modes_from_finance_settings_table.php'))[0]));
    }
}
