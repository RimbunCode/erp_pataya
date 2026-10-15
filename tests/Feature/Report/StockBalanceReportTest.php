<?php

namespace Tests\Feature\Report;

use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class StockBalanceReportTest extends TestCase {
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

    /**
     * Izin select pada Stock (modul Inventory) untuk user uji.
     */
    private function withInventoryAccess(): static {
        return $this->withSession([
            'permissions' => [
                StockLedgerEntry::class => [
                    0 => [
                        [
                            'model'        => StockLedgerEntry::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ]);
    }

    /**
     * Sisipkan satu stok (item x gudang) langsung ke tabel, lalu kembalikan id-nya.
     */
    private function insertStock(string $warehouseId, float $quantity, float $valuationRate, ?string $categoryId = null): string {
        $itemVariant   = ItemVariant::factory()->create(['category_id' => $categoryId]);
        $itemVariantId = $itemVariant->id;
        $itemUnitId    = $this->insertItemUnit($itemVariant->item_id);

        $stockId = (string) Str::ulid();
        DB::table('stocks')->insert([
            'id'                => $stockId,
            'item_variant_id'   => $itemVariantId,
            'warehouse_id'      => $warehouseId,
            'item_unit_id'      => $itemUnitId,
            'quantity'          => $quantity,
            'reserved_quantity' => 0,
            'incoming_quantity' => 0,
            'rented_quantity'   => 0,
            'conversion_factor' => 1,
            'valuation_rate'    => $valuationRate,
            'stock_queue'       => '[]',
            'details'           => '{}',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $stockId;
    }

    /**
     * Satuan dan konversi item (item_units) yang dibutuhkan kolom stocks.item_unit_id.
     */
    private function insertItemUnit(string $itemId): string {
        $unitId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'         => $unitId,
            'code'       => 'U-' . Str::upper(Str::random(4)),
            'name'       => 'Pcs',
            'is_default' => 0,
            'is_example' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemId,
            'unit_id'           => $unitId,
            'conversion_factor' => 1,
            'is_default'        => 1,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    private function insertWarehouse(): string {
        $branch      = Branch::query()->first() ?? Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $warehouseId = (string) Str::ulid();
        DB::table('warehouses')->insert([
            'id'         => $warehouseId,
            'branch_id'  => $branch->id,
            'name'       => 'Gudang ' . Str::upper(Str::random(3)),
            'code'       => 'WH-' . Str::upper(Str::random(4)),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $warehouseId;
    }

    public function test_kpi_cocok_dengan_hitungan_manual_seluruh_baris_dan_tabel(): void {
        $warehouse = $this->insertWarehouse();
        $this->insertStock($warehouse, 10, 1500);
        $this->insertStock($warehouse, 4, 250);
        $this->insertStock($warehouse, 0, 999);

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockBalance'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/StockBalance')
            ->where('kpi.0.value', 2)
            ->where('kpi.1.value', 10 * 1500 + 4 * 250)
            ->where('consistency', null));
    }

    public function test_filter_gudang_menyaring_tabel_dan_kpi_bersamaan(): void {
        $warehouseA = $this->insertWarehouse();
        $warehouseB = $this->insertWarehouse();
        $this->insertStock($warehouseA, 5, 100);
        $this->insertStock($warehouseB, 7, 1000);

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockBalance', ['warehouse_id' => $warehouseA]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.1.value', 5 * 100)
            ->where('kpi.0.value', 1));
    }

    public function test_filter_terakhir_diingat_di_session_saat_tabel_dimuat_ulang(): void {
        $warehouseA = $this->insertWarehouse();
        $warehouseB = $this->insertWarehouse();
        $this->insertStock($warehouseA, 5, 100);
        $this->insertStock($warehouseB, 7, 1000);

        $this->actingAs($this->user)->withInventoryAccess()
            ->get(route('reports.stockBalance', ['warehouse_id' => $warehouseA]))
            ->assertOk();

        // Muat ulang tanpa parameter filter (seperti XHR DataTable2): filter session dipakai.
        $this->get(route('reports.stockBalance', ['page' => 1]))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('kpi.1.value', 5 * 100));
    }

    public function test_populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $warehouse = $this->insertWarehouse();

        $response = $this->actingAs($this->user)->withInventoryAccess()->get(route('reports.stockBalance', ['warehouse_id' => $warehouse]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.1.value', 0));
    }

    public function test_pengguna_tanpa_izin_inventory_ditolak(): void {
        $this->insertStock($this->insertWarehouse(), 1, 1);

        $this->actingAs($this->user)->get(route('reports.stockBalance'))->assertForbidden();
    }
}
