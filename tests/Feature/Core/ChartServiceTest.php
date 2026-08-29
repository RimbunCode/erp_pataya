<?php

namespace Tests\Feature\Core;

use App\Models\Core\Chart;
use App\Models\Core\Dashboard;
use App\Models\DashboardWidget;
use App\Models\Model as AppModel;
use App\Services\Core\ChartService;
use App\Services\Core\PermissionChecker;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ChartTestRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'chart_test_records';
    protected $guarded = ['id'];
}

class ChartServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('chart_test_records')) {
            Schema::create('chart_test_records', function ($t) {
                $t->ulid('id')->primary();
                $t->decimal('amount', 15, 2)->default(0);
                $t->string('category')->nullable();
                $t->timestamps();
            });
        }
    }

    private function service(): ChartService {
        return app(ChartService::class);
    }

    private function noopChecker(): PermissionChecker {
        return new PermissionChecker([]);
    }

    /**
     * Requirement 5.1/5.4: agregat per NILAI DISTINCT (bukan per waktu),
     * dan jalur ini tidak pernah memanggil logic time-series.
     */
    public function test_group_by_aggregates_by_distinct_field_not_time(): void {
        ChartTestRecord::create(['amount' => 10, 'category' => 'A']);
        ChartTestRecord::create(['amount' => 20, 'category' => 'A']);
        ChartTestRecord::create(['amount' => 5, 'category' => 'B']);

        $chart = Chart::create([
            'chart_name'        => 'By Category', 'model_class' => ChartTestRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category',
            'group_by_type'     => 'sum', 'aggregate_function_based_on' => 'amount',
        ]);

        $result = $this->service()->getData($chart, [], $this->noopChecker());

        $this->assertSame(['A', 'B'], $result['labels']);
        $this->assertSame([30.0, 5.0], $result['datasets'][0]['values']);
    }

    public function test_group_by_count_type(): void {
        ChartTestRecord::create(['category' => 'A']);
        ChartTestRecord::create(['category' => 'A']);
        ChartTestRecord::create(['category' => 'B']);

        $chart = Chart::create([
            'chart_name'        => 'Count By Category', 'model_class' => ChartTestRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category', 'group_by_type' => 'count',
        ]);

        $result = $this->service()->getData($chart, [], $this->noopChecker());

        $this->assertSame(['A', 'B'], $result['labels']);
        $this->assertSame([2.0, 1.0], $result['datasets'][0]['values']);
    }

    /** Requirement 5.2: limit number_of_groups, urut desc. */
    public function test_group_by_respects_number_of_groups_limit(): void {
        foreach (['A', 'B', 'C'] as $cat) {
            ChartTestRecord::create(['category' => $cat]);
        }

        $chart = Chart::create([
            'chart_name'        => 'Limited', 'model_class' => ChartTestRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category',
            'group_by_type'     => 'count', 'number_of_groups' => 2,
        ]);

        $result = $this->service()->getData($chart, [], $this->noopChecker());

        $this->assertCount(2, $result['labels']);
    }

    /**
     * Requirement 5.3: label relasi HANYA resolve kalau user punya Select
     * ke model relasinya. `DashboardWidget.dashboard_id` -> `Dashboard`
     * (templateLink ':title', cocok heuristik regex resolver).
     */
    public function test_group_by_relation_label_resolved_only_with_permission(): void {
        $dashboardA = Dashboard::create(['title' => 'Dashboard A']);
        $dashboardB = Dashboard::create(['title' => 'Dashboard B']);
        DashboardWidget::create(['type' => 'text', 'width' => 'full', 'order' => 0, 'is_visible' => true, 'dashboard_id' => $dashboardA->id]);
        DashboardWidget::create(['type' => 'text', 'width' => 'full', 'order' => 1, 'is_visible' => true, 'dashboard_id' => $dashboardA->id]);
        DashboardWidget::create(['type' => 'text', 'width' => 'full', 'order' => 2, 'is_visible' => true, 'dashboard_id' => $dashboardB->id]);

        $chart = Chart::create([
            'chart_name'        => 'By Dashboard', 'model_class' => DashboardWidget::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'dashboard', 'group_by_type' => 'count',
        ]);

        $withPermission = new PermissionChecker([
            Dashboard::class => [0 => [['model' => Dashboard::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true]]]],
        ]);
        $resultWithPermission = $this->service()->getData($chart, [], $withPermission);
        $this->assertContains('Dashboard A', $resultWithPermission['labels']);
        $this->assertContains('Dashboard B', $resultWithPermission['labels']);

        $resultWithoutPermission = $this->service()->getData($chart, [], $this->noopChecker());
        $this->assertNotContains('Dashboard A', $resultWithoutPermission['labels']);
        $this->assertContains($dashboardA->id, $resultWithoutPermission['labels']);
    }

    /** Requirement 6.1: count per hari dalam heatmap_year. */
    public function test_heatmap_counts_per_day(): void {
        $r1             = ChartTestRecord::create(['amount' => 1]);
        $r1->created_at = '2026-03-01 10:00:00';
        $r1->save();
        $r2             = ChartTestRecord::create(['amount' => 1]);
        $r2->created_at = '2026-03-01 15:00:00';
        $r2->save();
        $r3             = ChartTestRecord::create(['amount' => 1]);
        $r3->created_at = '2025-03-01 10:00:00'; // tahun beda, tidak boleh ikut
        $r3->save();

        $chart = Chart::create([
            'chart_name'        => 'Heatmap', 'model_class' => ChartTestRecord::class,
            'chart_source_type' => 'count', 'visual_type' => 'heatmap', 'heatmap_year' => 2026,
        ]);

        $result = $this->service()->getData($chart, [], $this->noopChecker());
        $dayKey = strtotime('2026-03-01');

        $this->assertSame(2, $result[$dayKey]);
        $this->assertCount(1, $result);
    }

    /** Requirement 3.2/5.4: jalur group_by tidak pernah "count by time". */
    public function test_group_by_does_not_fall_back_to_time_bucketing(): void {
        ChartTestRecord::create(['category' => 'A']);

        $chart = Chart::create([
            'chart_name'        => 'Regression', 'model_class' => ChartTestRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category', 'group_by_type' => 'count',
            'timeseries'        => true, 'based_on' => 'created_at', 'time_interval' => 'monthly',
        ]);

        $result = $this->service()->getData($chart, [], $this->noopChecker());

        // Hasil group_by TIDAK punya struktur 'period' (ciri jalur time-series).
        $this->assertArrayHasKey('labels', $result);
        $this->assertArrayNotHasKey('period', $result);
    }
}
