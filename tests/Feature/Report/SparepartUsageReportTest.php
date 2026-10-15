<?php

namespace Tests\Feature\Report;

use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\Report\SparepartUsageRow;
use App\Models\User\User;
use App\Services\Report\Sparepart\SparepartUsageFilter;
use App\Services\Report\Sparepart\SparepartUsageKpiBuilder;
use Database\Factories\Asset\AssetServiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class SparepartUsageReportTest extends TestCase {
    use InsertsReportData;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, AssetService::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    /**
     * Satu item yang dikonsumsi pada sebuah AssetService. total_value dihitung app: quantity * rate.
     */
    private function reportConsumedItem(string $itemId, float $quantity, float $rate, ?string $serviceId = null): void {
        $serviceId ??= AssetServiceFactory::new()->create(['start_date' => '2026-10-02 00:00:00'])->id;

        $this->reportInsertRow('asset_service_consumed_items', [
            'id'               => (string) Str::ulid(),
            'asset_service_id' => $serviceId,
            'item_id'          => $itemId,
            'item_unit_id'     => $this->reportItemUnit($itemId),
            'quantity'         => $quantity,
            'valuation_rate'   => $rate,
            'total_value'      => $quantity * $rate,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_seluruh_item_konsumsi(): void {
        $this->reportConsumedItem($this->reportItemVariant(), 2, 100);
        $this->reportConsumedItem($this->reportItemVariant(), 3, 50);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.sparepartUsage'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/SparepartUsage')
            ->where('kpi.0.value', 2)
            ->where('kpi.1.value', 5)
            ->where('kpi.2.value', 350)
            ->where('consistency', null));
    }

    #[Test]
    public function total_nilai_kpi_cocok_dengan_jumlah_total_value(): void {
        $this->reportConsumedItem($this->reportItemVariant(), 2, 100);
        $this->reportConsumedItem($this->reportItemVariant(), 1, 25);

        $manualTotal = (float) DB::table('asset_service_consumed_items')->sum('total_value');

        $kpi = app(SparepartUsageKpiBuilder::class)->build(SparepartUsageFilter::fromValues([]));

        $this->assertSame($manualTotal, $kpi->values['total_value']);
        $this->assertSame(2, $kpi->rowCount);
    }

    #[Test]
    public function filter_item_menyaring_tabel_dan_kpi_bersamaan(): void {
        $itemX = $this->reportItemVariant();
        $this->reportConsumedItem($itemX, 2, 100);
        $this->reportConsumedItem($this->reportItemVariant(), 9, 999);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)
            ->get(route('reports.sparepartUsage', ['item_variant_id' => $itemX]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.2.value', 200)
            ->where('consistency', null));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.sparepartUsage'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.2.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_asset_service_ditolak(): void {
        $this->reportConsumedItem($this->reportItemVariant(), 1, 1);

        $this->actingAs($this->user)->get(route('reports.sparepartUsage'))->assertForbidden();
    }

    #[Test]
    public function baris_konsumsi_membaca_tanggal_mulai_pekerjaan(): void {
        $this->reportConsumedItem($this->reportItemVariant(), 1, 10);

        $row = SparepartUsageRow::query()->firstOrFail();

        $this->assertStringStartsWith('2026-10-02', (string) $row->transaction_date);
    }
}
