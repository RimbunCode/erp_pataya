<?php

namespace Tests\Feature\Core;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * desk-dashboard-builder Requirement 1.4-1.5: rollback 2 migration
 * width-related terbaru untuk insert data lama (width string 'half'/'full'),
 * lalu migrate ulang dan pastikan hasil konversi ke integer 6/12 benar.
 */
class DashboardWidgetWidthMigrationTest extends TestCase {
    use RefreshDatabase;

    /**
     * Migration pertama dari dua migration width yang diuji di sini. Rollback
     * harus mundur sampai SEBELUM berkas ini.
     */
    private const FIRST_WIDTH_MIGRATION = '2026_08_25_160734_add_col_span_to_dashboard_widgets_table.php';

    /**
     * Berapa langkah rollback untuk kembali ke sebelum kedua migration width.
     *
     * Dihitung dari isi direktori migration, bukan ditulis sebagai angka tetap.
     * Nilai tetap sebelumnya harus diperbarui manual setiap ada migration baru
     * dari branch mana pun, dan berkali-kali tertinggal — terakhir saat lima
     * migration spec quotation-letter-fields masuk, membuat test ini merah di
     * CI.
     *
     * Salah hitung berakibat lebih luas daripada test ini sendiri: rollback
     * yang kurang jauh membuat re-migrate berhenti di tengah tanpa melempar
     * (Artisan::call tidak throw), meninggalkan skema rusak pada koneksi
     * :memory: yang persisten untuk sisa suite.
     */
    private function stepsBackToWidthMigration(): int {
        $files = glob(database_path('migrations/*.php')) ?: [];
        $names = array_map('basename', $files);
        sort($names);

        $index = array_search(self::FIRST_WIDTH_MIGRATION, $names, true);

        $this->assertNotFalse(
            $index,
            'Migration ' . self::FIRST_WIDTH_MIGRATION . ' tidak ditemukan. '
            . 'Kalau berkasnya memang diganti nama, perbarui FIRST_WIDTH_MIGRATION.',
        );

        return \count($names) - $index;
    }

    public function test_half_and_full_width_values_are_converted_to_integer_col_span(): void {
        Artisan::call('migrate:rollback', ['--step' => $this->stepsBackToWidthMigration()]);

        $dashboardId = (string) Str::ulid();
        DB::table('dashboards')->insert([
            'id'         => $dashboardId,
            'title'      => 'Legacy Dashboard',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $halfId = (string) Str::ulid();
        $fullId = (string) Str::ulid();
        DB::table('dashboard_widgets')->insert([
            [
                'id'           => $halfId,
                'dashboard_id' => $dashboardId,
                'width'        => 'half',
                'order'        => 0,
                'is_visible'   => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'id'           => $fullId,
                'dashboard_id' => $dashboardId,
                'width'        => 'full',
                'order'        => 1,
                'is_visible'   => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
        ]);

        Artisan::call('migrate');

        $halfRow = DB::table('dashboard_widgets')->where('id', $halfId)->first();
        $fullRow = DB::table('dashboard_widgets')->where('id', $fullId)->first();

        $this->assertSame(6, (int) $halfRow->width);
        $this->assertSame(12, (int) $fullRow->width);
    }
}
