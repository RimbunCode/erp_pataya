<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\SalesInvoice;
use App\Models\Report\SalesReportRow;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Report\Sales\SalesFilter;
use App\Services\Report\Sales\SalesKpiBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class SalesReportTest extends TestCase {
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

        // Sama seperti SalesOrderDiscountPersistenceTest: initPermissions() men-seed kolom
        // runtime (code, status) yang tidak ada di skema migration tes, dan FormatingSeries
        // untuk generate kode dokumen.
        foreach ([User::class, FormatingSeries::class, SalesOrder::class, SalesInvoice::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_seluruh_so(): void {
        // SO 1: basic 2*100 + 3*100 = 500, pajak 11% = 55, kuantitas 5.
        $this->reportSalesOrder(['date' => '2026-10-01 10:00:00'], [
            ['quantity' => 2, 'price' => 100, 'tax_rate' => 11],
            ['quantity' => 3, 'price' => 100, 'tax_rate' => 11],
        ]);
        // SO 2: basic 4*125 = 500, diskon 50 (DPP 450), pajak 11% dari basic = 55, kuantitas 4.
        $this->reportSalesOrder(['date' => '2026-10-02 10:00:00'], [
            ['quantity' => 4, 'price' => 125, 'discount_amount' => 50, 'tax_rate' => 11],
        ]);

        $response = $this->actingAs($this->user)->withModelAccess(SalesOrder::class)->get(route('reports.sales'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/Sales')
            ->where('kpi.0.value', 2)
            ->where('kpi.1.value', 9)
            ->where('kpi.2.value', 950)
            ->where('kpi.3.value', 110)
            ->where('consistency', null));
    }

    #[Test]
    public function kpi_builder_cocok_dengan_hitungan_manual(): void {
        $this->reportSalesOrder([], [['quantity' => 2, 'price' => 50, 'tax_rate' => 10]]);

        $kpi = app(SalesKpiBuilder::class)->build(SalesFilter::fromValues([]));

        $this->assertSame(1, $kpi->rowCount);
        $this->assertSame(100.0, $kpi->values['sales_value']);
        $this->assertSame(10.0, $kpi->values['tax_value']);
    }

    #[Test]
    public function filter_pelanggan_menyaring_tabel_dan_kpi_bersamaan(): void {
        $customerA = Customer::query()->create(['name' => 'Pelanggan A', 'is_disabled' => false])->id;
        $customerB = Customer::query()->create(['name' => 'Pelanggan B', 'is_disabled' => false])->id;
        $this->reportSalesOrder(['customer_id' => $customerA], [['quantity' => 1, 'price' => 100]]);
        $this->reportSalesOrder(['customer_id' => $customerB], [['quantity' => 9, 'price' => 100]]);

        $response = $this->actingAs($this->user)->withModelAccess(SalesOrder::class)
            ->get(route('reports.sales', ['customer_id' => $customerA]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.2.value', 100)
            ->where('consistency', null));
    }

    #[Test]
    public function filter_item_memilih_so_yang_memuat_item_tersebut(): void {
        $itemX = $this->reportItemVariant();
        $itemY = $this->reportItemVariant();
        $this->reportSalesOrder([], [['item_id' => $itemX, 'quantity' => 1, 'price' => 10]]);
        $this->reportSalesOrder([], [['item_id' => $itemY, 'quantity' => 1, 'price' => 20]]);
        $this->reportSalesOrder([], [['item_id' => $itemY, 'quantity' => 1, 'price' => 30], ['item_id' => $itemX, 'quantity' => 1, 'price' => 40]]);

        $response = $this->actingAs($this->user)->withModelAccess(SalesOrder::class)
            ->get(route('reports.sales', ['item_variant_id' => $itemX]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 2)
            ->where('consistency', null));
    }

    #[Test]
    public function filter_rentang_tanggal_dan_grafik_mengikuti_filter(): void {
        $this->reportSalesOrder(['date' => '2026-10-01 10:00:00'], [['quantity' => 1, 'price' => 100]]);
        $this->reportSalesOrder(['date' => '2026-10-20 10:00:00'], [['quantity' => 1, 'price' => 999]]);

        $response = $this->actingAs($this->user)->withModelAccess(SalesOrder::class)
            ->get(route('reports.sales', ['date_from' => '2026-10-01', 'date_to' => '2026-10-15']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('chart.series.0.date', '2026-10-01')
            ->where('chart.series.0.value', 100)
            ->has('chart.series', 1));
    }

    #[Test]
    public function status_pengiriman_diturunkan_dari_kuantitas_terkirim(): void {
        $this->reportSalesOrder([], [['quantity' => 4, 'delivered_quantity' => 4, 'price' => 10]]);
        $this->reportSalesOrder([], [['quantity' => 4, 'delivered_quantity' => 1, 'price' => 10]]);
        $this->reportSalesOrder([], [['quantity' => 4, 'delivered_quantity' => 0, 'price' => 10]]);

        // Accessor label dibaca di luar request, jadi locale diatur eksplisit.
        app()->setLocale('id');
        $labels = SalesReportRow::query()->get()->pluck('delivery_label')->sort()->values()->all();

        $this->assertSame(['Belum dikirim', 'Terkirim', 'Terkirim sebagian'], $labels);
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(SalesOrder::class)->get(route('reports.sales'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.2.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_sales_ditolak(): void {
        $this->reportSalesOrder([], [['quantity' => 1, 'price' => 1]]);

        $this->actingAs($this->user)->get(route('reports.sales'))->assertForbidden();
    }
}
