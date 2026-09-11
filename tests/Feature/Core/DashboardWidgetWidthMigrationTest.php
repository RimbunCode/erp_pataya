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

    public function test_half_and_full_width_values_are_converted_to_integer_col_span(): void {
        // --step tidak lagi 2: number-card-chart-redesign menambah 6 migration
        // BARU setelah 2 migration width ini (create_number_cards/charts/
        // assignables + alter/drop dashboard_widgets/widgets) — --step harus
        // mundur SAMPAI SEBELUM kedua migration width, bukan cuma 2 langkah
        // terakhir (yang sekarang migration lain). Lihat `php artisan
        // migrate:status` utk hitungan pasti kalau ada migration baru lagi.
        //
        // Update 2026-08-31 (merge dev-rahmad-5): 4 migration lagi nambah
        // setelah ke-8 migration di atas (asset_service_consumed_items FK
        // change, show_full_number, icon+description NumberCard & Chart) —
        // 8 + 4 = 12.
        // Update 2026-09-04: 1 migration lagi nambah (Filter Templates,
        // add_shared_columns_to_saved_filters_table) — 12 + 1 = 13.
        // Update 2026-09-09 (spec asset-category-simplification): 2 migration
        // lagi nambah (rentable/allow_bulk_quantity pindah AssetCategory ->
        // Asset) — 13 + 2 = 15.
        // Update 2026-09-10 (spec asset-service-progress-workflow): 2
        // migration lagi nambah (start_date di asset_services, status
        // replace is_done di asset_service_activities) — 15 + 2 = 17.
        // Catatan: "migration width pertama" itu 2026_08_25_160734_add_
        // col_span_to_dashboard_widgets_table.php (BUKAN yang 160904_rename
        // -- itu migration KEDUA dari 2 migration width yang dimaksud,
        // hitung dari situ hasilnya kurang 1 dan nilai half/full ketuker).
        // --step yang salah TIDAK bikin test ini sendiri gagal (SQLite
        // lenient soal kolom insert), tapi migrate:rollback+migrate di
        // koneksi :memory: PERSISTEN sepanjang run PHPUnit ini efeknya BOCOR
        // ke SEMUA test lain yang jalan setelahnya dalam proses yang sama --
        // step yang salah membuat re-migrate berhenti di tengah tanpa
        // exception (Artisan::call tidak throw), meninggalkan skema rusak
        // (mis. tabel `logs` hilang) utk sisa suite. WAJIB dihitung ulang
        // via `ls database/migrations | sort | grep -A 999 "2026_08_25_
        // 160734_add_col_span_to_dashboard_widgets_table.php" | wc -l` tiap
        // kali ada migration baru, BUKAN ditambah manual berdasar ingatan.
        Artisan::call('migrate:rollback', ['--step' => 17]);

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
