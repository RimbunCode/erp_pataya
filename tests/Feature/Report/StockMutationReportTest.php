<?php

namespace Tests\Feature\Report;

use App\Models\User\User;
use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\StockMutation\StockMutationFilter;
use App\Services\Report\StockMutation\StockMutationKpiBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class StockMutationReportTest extends TestCase {
    use InsertsReportData;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        // is_example ditambahkan di prod lewat init, bukan migration (lihat TicketTest).
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Halaman Inertia baru belum punya build Vite di lingkungan tes.
        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_dan_isi_tabel(): void {
        $warehouse = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => 10]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => -4]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => -3]);

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockMutation'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/StockMutation')
            ->where('kpi.0.value', 3)
            ->where('kpi.1.value', 10)
            ->where('kpi.2.value', 7)
            ->where('consistency', null));
    }

    #[Test]
    public function kpi_builder_dan_jalur_tabel_menghitung_baris_yang_sama(): void {
        $warehouse = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => 2]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => -5]);

        $filter = StockMutationFilter::fromValues([]);
        $kpi    = app(StockMutationKpiBuilder::class)->build($filter);

        $this->assertSame(2, $kpi->rowCount);
        $this->assertSame(2.0, $kpi->values['total_in']);
        $this->assertSame(5.0, $kpi->values['total_out']);

        // Tidak ada selisih: pemeriksaan konsistensi mengembalikan null.
        $this->assertNull(app(ReportConsistencyChecker::class)->check(
            'Mutasi Stock',
            $kpi,
            2,
            [],
            request(),
        ));
    }

    #[Test]
    public function filter_rentang_tanggal_inklusif_pada_kedua_ujung(): void {
        $warehouse = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-09-30 23:59:59']);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-01 00:00:00']);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-15 23:30:00']);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-16 00:00:00']);

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockMutation', [
            'date_from' => '2026-10-01',
            'date_to'   => '2026-10-15',
        ]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 2)
            ->where('consistency', null));
    }

    #[Test]
    public function filter_item_dan_gudang_menyaring_tabel_dan_kpi_bersamaan(): void {
        $warehouseA = $this->reportWarehouse();
        $warehouseB = $this->reportWarehouse();
        $itemX      = $this->reportItemVariant();
        $itemY      = $this->reportItemVariant();

        $this->reportLedgerEntry(['item_id' => $itemX, 'warehouse_id' => $warehouseA, 'quantity_change' => 1]);
        $this->reportLedgerEntry(['item_id' => $itemX, 'warehouse_id' => $warehouseB, 'quantity_change' => 1]);
        $this->reportLedgerEntry(['item_id' => $itemY, 'warehouse_id' => $warehouseA, 'quantity_change' => 1]);

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockMutation', [
            'item_variant_id' => $itemX,
            'warehouse_id'    => $warehouseA,
        ]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.1.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function kpi_dan_tabel_mengikuti_cabang_yang_sama(): void {
        $branchMain     = $this->reportBranch(true);
        $branchOther    = $this->reportBranch(false);
        $warehouseMain  = $this->reportWarehouse($branchMain);
        $warehouseOther = $this->reportWarehouse($branchOther);

        $this->reportLedgerEntry(['warehouse_id' => $warehouseMain, 'quantity_change' => 9]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouseOther, 'quantity_change' => 1]);

        // Pengguna berada di cabang non-utama: hanya baris cabang itu yang boleh muncul.
        $response = $this->actingAs($this->user)
            ->withInventoryAccess()
            ->withSession(['currentBranch' => $branchOther])
            ->get(route('reports.stockMutation'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.1.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockMutation'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.1.value', 0)
            ->where('kpi.2.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_inventory_ditolak(): void {
        $this->reportLedgerEntry(['quantity_change' => 1]);

        $this->actingAs($this->user)->get(route('reports.stockMutation'))->assertForbidden();
    }
}
