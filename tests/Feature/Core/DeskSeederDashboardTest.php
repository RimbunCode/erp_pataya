<?php

namespace Tests\Feature\Core;

use App\Enums\Domain;
use App\Models\Core\Chart;
use App\Models\Core\Desk;
use App\Models\Core\NumberCard;
use App\Models\DashboardWidget;
use Database\Seeders\DeskSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Spec desk-dashboard-content-seeder — konten Dashboard 9 Desk system.
 */
class DeskSeederDashboardTest extends TestCase {
    use RefreshDatabase;

    public function test_seeder_fills_dashboard_for_every_system_desk(): void {
        (new DeskSeeder)->run();

        $this->assertSame(9, Desk::whereNotNull('dashboard_id')->count());

        foreach (Desk::whereNotNull('dashboard_id')->get() as $desk) {
            $this->assertGreaterThan(
                0,
                DashboardWidget::where('dashboard_id', $desk->dashboard_id)->count(),
                "Desk domain={$desk->domain->value} tidak punya widget dashboard.",
            );
        }
    }

    public function test_every_desk_has_card_chart_quick_list_and_link_card(): void {
        (new DeskSeeder)->run();

        foreach (Desk::whereNotNull('dashboard_id')->get() as $desk) {
            $types = DashboardWidget::where('dashboard_id', $desk->dashboard_id)->pluck('type')->all();

            $this->assertContains('card', $types, "Desk {$desk->domain->value} tidak punya card.");
            $this->assertContains('chart', $types, "Desk {$desk->domain->value} tidak punya chart.");
            $this->assertContains('quick_list', $types, "Desk {$desk->domain->value} tidak punya quick_list.");
            $this->assertContains('link_card', $types, "Desk {$desk->domain->value} tidak punya link_card.");
            $this->assertContains('link_card_item', $types, "Desk {$desk->domain->value} tidak punya link_card_item.");
            $this->assertNotContains('shortcut', $types, "Desk {$desk->domain->value} seharusnya tidak punya shortcut.");
        }
    }

    public function test_seeder_is_idempotent_when_run_twice(): void {
        (new DeskSeeder)->run();
        $firstCount = DashboardWidget::count();

        (new DeskSeeder)->run();

        $this->assertSame($firstCount, DashboardWidget::count());
    }

    public function test_seeder_does_not_overwrite_dashboard_with_existing_manual_widget(): void {
        (new DeskSeeder)->run();

        $salesDesk = Desk::where('domain', Domain::Sales->value)->firstOrFail();
        DashboardWidget::where('dashboard_id', $salesDesk->dashboard_id)->delete();
        DashboardWidget::create([
            'dashboard_id' => $salesDesk->dashboard_id,
            'type'         => 'text',
            'config'       => ['json' => null, 'html' => '<p>Edit manual user</p>'],
            'order'        => 0,
            'width'        => 12,
            'is_visible'   => true,
        ]);

        (new DeskSeeder)->run();

        $this->assertSame(
            1,
            DashboardWidget::where('dashboard_id', $salesDesk->dashboard_id)->count(),
            'Seeder seharusnya skip desk yang sudah punya widget (hasil edit manual), bukan menimpa.',
        );
    }

    public function test_group_by_charts_have_required_fields(): void {
        (new DeskSeeder)->run();

        $groupByCharts = Chart::where('chart_source_type', 'group_by')->get();
        $this->assertGreaterThan(0, $groupByCharts->count());
        foreach ($groupByCharts as $chart) {
            $this->assertNotEmpty($chart->group_by_based_on, "Chart '{$chart->chart_name}' group_by tanpa group_by_based_on.");
            $this->assertNotEmpty($chart->group_by_type, "Chart '{$chart->chart_name}' group_by tanpa group_by_type.");
        }
    }

    public function test_cards_with_non_count_function_have_aggregate_column(): void {
        (new DeskSeeder)->run();

        $cards = NumberCard::where('function', '!=', 'count')->get();
        $this->assertGreaterThan(0, $cards->count());
        foreach ($cards as $card) {
            $this->assertNotEmpty($card->aggregate_function_based_on, "NumberCard '{$card->label}' function!=count tanpa aggregate_function_based_on.");
        }
    }

    // Test model_id -> Permission resolution SENGAJA tidak diuji di sini:
    // PermissionSeeder::run() standalone butuh >1GB memory (isu pre-existing
    // di luar scope spec ini, lihat memory project_pretest_bugs_dev_rahmad_5).
    // Resolusi model_id tetap tervalidasi tidak langsung lewat
    // `php artisan db:seed` penuh (Task 8 tasks.md — DatabaseSeeder jalankan
    // PermissionSeeder SEBELUM DeskSeeder, urutan sudah benar).
}
