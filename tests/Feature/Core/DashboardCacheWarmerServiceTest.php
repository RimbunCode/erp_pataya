<?php

namespace Tests\Feature\Core;

use App\Models\Core\Chart;
use App\Models\Core\Dashboard;
use App\Models\Core\NumberCard;
use App\Models\DashboardWidget;
use App\Models\Model as AppModel;
use App\Services\Core\ChartService;
use App\Services\Core\DashboardCacheWarmerService;
use App\Services\Core\NumberCardService;
use App\Services\Core\PermissionChecker;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WarmerTestRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'warmer_test_records';
    protected $guarded = ['id'];
}

class DashboardCacheWarmerServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('warmer_test_records')) {
            Schema::create('warmer_test_records', function ($t) {
                $t->ulid('id')->primary();
                $t->decimal('amount', 15, 2)->default(0);
                $t->string('category')->nullable();
                $t->timestamps();
            });
        }
    }

    private function warmer(): DashboardCacheWarmerService {
        return app(DashboardCacheWarmerService::class);
    }

    private function attachWidget(string $type, ?string $numberCardId = null, ?string $chartId = null, bool $isVisible = true): DashboardWidget {
        $dashboard = Dashboard::create(['title' => 'Dashboard-' . uniqid()]);

        return DashboardWidget::create([
            'type'           => $type,
            'width'          => 'full',
            'order'          => 0,
            'is_visible'     => $isVisible,
            'dashboard_id'   => $dashboard->id,
            'number_card_id' => $numberCardId,
            'chart_id'       => $chartId,
        ]);
    }

    /** Requirement H: NumberCard yg terpasang widget visible ikut di-warm, cache jadi hit tanpa query DB lagi. */
    public function test_warm_populates_number_card_cache(): void {
        WarmerTestRecord::create(['amount' => 10]);
        WarmerTestRecord::create(['amount' => 20]);
        $card = NumberCard::create(['label' => 'X', 'model_class' => WarmerTestRecord::class, 'function' => 'count']);
        $this->attachWidget('card', numberCardId: $card->id);

        $result = $this->warmer()->warm();

        $this->assertSame(1, $result['number_cards']);

        DB::enableQueryLog();
        $value   = app(NumberCardService::class)->getValue($card, []);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame(2.0, $value);
        $this->assertEmpty($queries, 'getValue() sesudah warm() harus cache-hit, tanpa query DB.');
    }

    /** NumberCard TANPA widget sama sekali (orphan) tidak ikut di-warm. */
    public function test_warm_skips_number_card_without_dashboard_widget(): void {
        NumberCard::create(['label' => 'Orphan', 'model_class' => WarmerTestRecord::class, 'function' => 'count']);

        $result = $this->warmer()->warm();

        $this->assertSame(0, $result['number_cards']);
    }

    /** Block tersembunyi (is_visible=false) tidak ikut di-warm — tak ada gunanya, tak ada viewer. */
    public function test_warm_skips_number_card_on_hidden_widget(): void {
        $card = NumberCard::create(['label' => 'Hidden', 'model_class' => WarmerTestRecord::class, 'function' => 'count']);
        $this->attachWidget('card', numberCardId: $card->id, isVisible: false);

        $result = $this->warmer()->warm();

        $this->assertSame(0, $result['number_cards']);
    }

    /** source_type=custom tidak ikut di-warm — resolvernya tidak lewat Cache::remember sama sekali. */
    public function test_warm_skips_custom_source_number_card(): void {
        $card = NumberCard::create(['label' => 'Custom', 'source_type' => 'custom', 'method' => 'anything']);
        $this->attachWidget('card', numberCardId: $card->id);

        $result = $this->warmer()->warm();

        $this->assertSame(0, $result['number_cards']);
    }

    /**
     * Requirement H: Chart (heatmap) yg terpasang widget visible ikut di-warm,
     * cache jadi hit tanpa query DB lagi. Heatmap dipilih (bukan timeseries)
     * krn `DATE_FORMAT` di getTimeSeriesChartConfig() adalah fungsi MySQL,
     * tidak didukung SQLite (driver test) — gap lama, di luar cakupan sesi
     * ini, mirror alasan ChartServiceTest.php sendiri tidak menguji jalur
     * timeseries mentah.
     */
    public function test_warm_populates_chart_cache(): void {
        $r1             = WarmerTestRecord::create(['amount' => 1]);
        $r1->created_at = '2026-03-01 10:00:00';
        $r1->save();
        $chart = Chart::create([
            'chart_name'        => 'Heatmap', 'model_class' => WarmerTestRecord::class,
            'chart_source_type' => 'count', 'visual_type' => 'heatmap', 'heatmap_year' => 2026,
        ]);
        $this->attachWidget('chart', chartId: $chart->id);

        $result = $this->warmer()->warm();

        $this->assertSame(1, $result['charts']);

        // ChartService (beda dari NumberCardService) sengaja cek Schema::
        // hasColumn() DI LUAR Cache::remember() (perlu utk bangun cache key
        // itu sendiri, lihat komentar getHeatmapChartConfig()) — jadi cache
        // hit TETAP nyisakan satu query introspeksi skema ringan, BUKAN
        // query agregat ke tabel data. Assert queri agregat (GROUP BY/SELECT
        // ke tabel data) hilang, bukan "nol query sama sekali".
        DB::enableQueryLog();
        $data          = app(ChartService::class)->getData($chart, [], new PermissionChecker([]), []);
        $schemaQueries = ['pragma', 'sqlite_master', 'information_schema'];
        $dataQueries   = collect(DB::getQueryLog())
            ->reject(fn ($q) => \collect($schemaQueries)->contains(fn ($needle) => str_contains(strtolower((string) $q['query']), $needle)))
            ->values();
        DB::disableQueryLog();

        $this->assertNotEmpty($data);
        $this->assertEmpty($dataQueries, 'getData() sesudah warm() harus cache-hit, tanpa query agregat ke tabel data.');
    }

    /** chart_source_type=custom tidak ikut di-warm. */
    public function test_warm_skips_custom_source_chart(): void {
        $chart = Chart::create(['chart_name' => 'Custom', 'chart_source_type' => 'custom', 'method' => 'anything']);
        $this->attachWidget('chart', chartId: $chart->id);

        $result = $this->warmer()->warm();

        $this->assertSame(0, $result['charts']);
    }
}
