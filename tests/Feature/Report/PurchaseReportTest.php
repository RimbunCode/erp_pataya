<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Report\Purchase\PurchaseFilter;
use App\Services\Report\Purchase\PurchaseKpiBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class PurchaseReportTest extends TestCase {
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

        // Kolom runtime (code, dst) dibentuk initPermissions(), sama seperti SalesReportTest.
        foreach ([User::class, FormatingSeries::class, PurchaseOrder::class, Supplier::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_seluruh_po(): void {
        // PO 1: basic 5*40 = 200, pajak 10% = 20, kuantitas 5.
        $this->reportPurchaseOrder(['date' => '2026-10-01 10:00:00'], [
            ['quantity' => 2, 'rate' => 40, 'tax_rate' => 10],
            ['quantity' => 3, 'rate' => 40, 'tax_rate' => 10],
        ]);
        // PO 2: basic 4*125 = 500, diskon 50 (nilai 450), pajak 10% dari basic = 50, kuantitas 4.
        $this->reportPurchaseOrder(['date' => '2026-10-02 10:00:00'], [
            ['quantity' => 4, 'rate' => 125, 'discount_amount' => 50, 'tax_rate' => 10],
        ]);

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseOrder::class)->get(route('reports.purchase'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/Purchase')
            ->where('kpi.0.value', 2)
            ->where('kpi.1.value', 9)
            ->where('kpi.2.value', 650)
            ->where('kpi.3.value', 70)
            ->where('consistency', null));
    }

    #[Test]
    public function kpi_builder_cocok_dengan_hitungan_manual(): void {
        $this->reportPurchaseOrder([], [['quantity' => 2, 'rate' => 50, 'tax_rate' => 10]]);

        $kpi = app(PurchaseKpiBuilder::class)->build(PurchaseFilter::fromValues([]));

        $this->assertSame(1, $kpi->rowCount);
        $this->assertSame(100.0, $kpi->values['purchase_value']);
        $this->assertSame(10.0, $kpi->values['tax_value']);
    }

    #[Test]
    public function filter_supplier_menyaring_tabel_dan_kpi_bersamaan(): void {
        $orderA = $this->reportPurchaseOrder([], [['quantity' => 1, 'rate' => 100]]);
        $this->reportPurchaseOrder([], [['quantity' => 9, 'rate' => 100]]);

        $supplierId = PurchaseOrder::query()->whereKey($orderA)->value('supplier_id');

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseOrder::class)
            ->get(route('reports.purchase', ['supplier_id' => $supplierId]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.2.value', 100)
            ->where('consistency', null));
    }

    #[Test]
    public function filter_item_memilih_po_yang_memuat_item_tersebut(): void {
        $itemX = $this->reportItemVariant();
        $this->reportPurchaseOrder([], [['item_id' => $itemX, 'quantity' => 1, 'rate' => 10]]);
        $this->reportPurchaseOrder([], [['quantity' => 1, 'rate' => 20]]);

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseOrder::class)
            ->get(route('reports.purchase', ['item_variant_id' => $itemX]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function grafik_mengikuti_rentang_tanggal(): void {
        $this->reportPurchaseOrder(['date' => '2026-10-01 10:00:00'], [['quantity' => 1, 'rate' => 100]]);
        $this->reportPurchaseOrder(['date' => '2026-10-20 10:00:00'], [['quantity' => 1, 'rate' => 999]]);

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseOrder::class)
            ->get(route('reports.purchase', ['date_from' => '2026-10-01', 'date_to' => '2026-10-15']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('chart.series.0.date', '2026-10-01')
            ->where('chart.series.0.value', 100)
            ->has('chart.series', 1));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(PurchaseOrder::class)->get(route('reports.purchase'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.2.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_purchase_ditolak(): void {
        $this->reportPurchaseOrder([], [['quantity' => 1, 'rate' => 1]]);

        $this->actingAs($this->user)->get(route('reports.purchase'))->assertForbidden();
    }
}
