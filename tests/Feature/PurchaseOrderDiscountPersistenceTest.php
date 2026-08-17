<?php

namespace Tests\Feature;

use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseOrderService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PurchaseOrderDiscountPersistenceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // initPermissions() menambah kolom runtime (code, status, dst) yang di produksi
        // dibuat oleh PermissionSeeder, bukan migration -- juga men-seed FormatingSeries
        // yang dibutuhkan PurchaseOrderService::create() untuk generate kode dokumen.
        // Pola diambil dari tests/Feature/Purchase/PurchaseOrderPermissionTest.php.
        foreach ([User::class, FormatingSeries::class, Supplier::class, PurchaseOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Supplier pakai trait TreeView (nested set) yang butuh lft/rgt/depth -- kolom ini
        // tidak ditambahkan oleh initPermissions() (beda mekanisme dari code/status/dst),
        // migration file suppliers juga tidak punya. Drift yang sama sudah dilaporkan di
        // spec invoice-dpp-adjustment task 9 ("Supplier memakai nested set yang butuh setup tambahan").
        if (! Schema::hasColumn('suppliers', 'lft')) {
            Schema::table('suppliers', function ($t) {
                $t->unsignedInteger('lft')->default(0);
                $t->unsignedInteger('rgt')->default(0);
                $t->unsignedInteger('depth')->default(0);
            });
        }

        Auth::login(User::factory()->create());
    }

    /**
     * @return array{item_id: string, unit_id: string}
     */
    private function createItemWithUnit(): array {
        $unit = Unit::create([
            'code' => 'UNIT-' . Str::random(6),
            'name' => 'Unit ' . Str::random(6),
        ]);

        $item = Item::factory()->create(['default_unit_id' => $unit->id]);

        $itemVariant = ItemVariantFactory::new()->for($item, 'item')->create();

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $itemUnitId,
            'item_id'    => $itemVariant->item_id,
            'unit_id'    => $itemVariant->default_unit_id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['item_id' => $itemVariant->id, 'unit_id' => $itemUnitId];
    }

    /**
     * Fixture baku dari requirements.md Part 5: line 1 = 10x100.000 @ PPN 11%,
     * line 2 = 5x200.000 @ 10%.
     */
    private function buildPayload(?string $discountOn = null, float $discountRate = 0, float $discountAmount = 0): array {
        $country   = CountryFactory::new()->create();
        $supplier  = Supplier::query()->create(['name' => 'PT Test Supplier', 'is_disabled' => false, 'country_id' => $country->code]);
        $warehouse = WarehouseFactory::new()->create();

        $line1    = $this->createItemWithUnit();
        $line2    = $this->createItemWithUnit();
        $taxPpn11 = TaxFactory::new()->create(['rate' => 11]);
        $taxPph10 = TaxFactory::new()->create(['rate' => 10]);

        return [
            'supplier'        => ['id' => $supplier->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => now()->toDateString(),
            'required_date'   => now()->addDay()->toDateString(),
            'discount_on'     => $discountOn,
            'discount_rate'   => $discountRate,
            'discount_amount' => $discountAmount,
            'items'           => [
                [
                    'id'               => (string) Str::ulid(),
                    'item'             => ['id' => $line1['item_id']],
                    'unit'             => ['id' => $line1['unit_id']],
                    'target_warehouse' => ['id' => $warehouse->id],
                    'tax'              => ['id' => $taxPpn11->id],
                    'quantity'         => 10,
                    'rate'             => 100000,
                    'required_date'    => now()->addDay()->toDateString(),
                ],
                [
                    'id'               => (string) Str::ulid(),
                    'item'             => ['id' => $line2['item_id']],
                    'unit'             => ['id' => $line2['unit_id']],
                    'target_warehouse' => ['id' => $warehouse->id],
                    'tax'              => ['id' => $taxPph10->id],
                    'quantity'         => 5,
                    'rate'             => 200000,
                    'required_date'    => now()->addDay()->toDateString(),
                ],
            ],
        ];
    }

    public function test_case_a_create_without_discount(): void {
        $purchaseOrder = app(PurchaseOrderService::class)->create($this->buildPayload());

        // Re-fetch -- create() mengubah basic_amount/tax_amount item lewat
        // applyDiscountToItems() SETELAH items()->create(), jadi relasi items
        // yang sudah ter-cache di $purchaseOrder masih berisi nilai sebelum
        // alokasi diskon (HasMany::create() men-cache child ke parent).
        $purchaseOrder = $purchaseOrder->fresh(['items']);

        $this->assertEqualsWithDelta(2000000, $purchaseOrder->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(210000, $purchaseOrder->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(2210000, $purchaseOrder->amount, 0.01);
    }

    public function test_case_b_create_with_ten_percent_discount_on_net_total(): void {
        $purchaseOrder = app(PurchaseOrderService::class)->create(
            $this->buildPayload('net_total', 10, 200000),
        );

        $purchaseOrder->refresh();
        $purchaseOrder->load('items');

        $this->assertEqualsWithDelta(1800000, $purchaseOrder->items->sum('basic_amount'), 0.01, 'DPP header harus turun setelah diskon, bukan beku');
        $this->assertEqualsWithDelta(189000, $purchaseOrder->items->sum('tax_amount'), 0.01, 'Pajak harus dihitung ulang dari basic_amount yang sudah dipotong diskon');
        $this->assertEqualsWithDelta(1989000, $purchaseOrder->amount, 0.01);

        // Reload dari DB murni (bukan dari memory) -- membuktikan nilai persisted, bukan cuma di render/memory
        $reloaded = $purchaseOrder->fresh(['items']);
        $this->assertEqualsWithDelta(1800000, $reloaded->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(189000, $reloaded->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(1989000, $reloaded->amount, 0.01);
    }

    public function test_case_c_create_with_ten_percent_discount_on_grand_total(): void {
        $purchaseOrder = app(PurchaseOrderService::class)->create(
            $this->buildPayload('grand_total', 10, 221000),
        );

        $purchaseOrder->refresh();
        $purchaseOrder->load('items');

        $this->assertEqualsWithDelta(1800000, $purchaseOrder->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(189000, $purchaseOrder->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(1989000, $purchaseOrder->amount, 0.01);
    }

    public function test_update_recalculates_discount_after_items_change(): void {
        $service = app(PurchaseOrderService::class);
        $created = $service->create($this->buildPayload('net_total', 10, 200000));
        // Re-fetch (bukan pakai instance $created langsung) -- DataTable::logForCreated()
        // set $this->dataAfter tanpa property terdeklarasi (beda dari $dataBefore yang
        // private array $dataBefore = []), jadi Eloquent's __set() magic menganggapnya
        // atribut model biasa dan menandai instance dirty untuk kolom "dataAfter" yang
        // tidak ada di tabel. save() berikutnya pada instance yang SAMA (co. fillForUpdate()
        // di dalam update()) akan gagal SQL "no such column: dataAfter". Pre-existing bug
        // di DataTable trait, di luar scope DPP -- di-workaround di sini dengan re-fetch.
        $purchaseOrder = $created->fresh(['items']);

        $payload                   = $this->buildPayload('net_total', 10, 200000);
        $payload['items'][0]['id'] = $purchaseOrder->items[0]->id;
        $payload['items'][1]['id'] = $purchaseOrder->items[1]->id;
        // Naikkan qty line pertama -- basis diskon berubah (jadi 3.000.000), alokasi harus ikut berubah
        $payload['items'][0]['quantity'] = 20;
        $payload['discount_amount']      = 300000; // 10% dari basis baru (2.000.000 + 1.000.000) = 3.000.000

        $updated = $service->update($purchaseOrder, $payload);
        $updated->load('items');

        $newSumBasic = $updated->items->sum('basic_amount');
        $newSumTax   = $updated->items->sum('tax_amount');

        $this->assertEqualsWithDelta($newSumBasic + $newSumTax, $updated->amount, 0.01, 'Total == DPP + Tax harus tetap benar setelah update dengan item berubah');
        $this->assertEqualsWithDelta($newSumBasic, $updated->fresh(['items'])->items->sum('basic_amount'), 0.01, 'nilai persisted harus sama dengan yang di-load ulang');
    }
}
