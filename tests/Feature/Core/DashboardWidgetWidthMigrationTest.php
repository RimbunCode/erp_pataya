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
        Artisan::call('migrate:rollback', ['--step' => 8]);

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
