<?php

namespace Tests\Feature\Sales;

use App\Models\Asset\Asset;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Tax;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use App\Services\Core\Approval\ApprovalService;
use App\Services\Sales\SalesOrderService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Requirement 7.1, 7.2, 7.6, 9.1, spec asset-items-section: SalesOrderService menggabungkan
 * `items` + `asset_items` di awal create/update, lalu memakai logic lama (tabel
 * `sales_order_items` yang sama, total dokumen dari kedua daftar).
 */
class SalesOrderServiceAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private Tax $tax;
    private string $warehouseId;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, SalesOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Auth::login(User::factory()->create());

        $this->tax         = TaxFactory::new()->create(['rate' => 11]);
        $this->warehouseId = WarehouseFactory::new()->create()->id;
    }

    /**
     * @return array{item_id: ?string, asset_id: ?string, unit_id: string}
     */
    private function createItemWithUnit(bool $fixedAsset): array {
        $unit = Unit::create(['code' => 'UNIT-' . Str::random(6), 'name' => 'Unit ' . Str::random(6)]);
        $item = Item::factory()->create([
            'default_unit_id' => $unit->id,
            'is_fixed_asset'  => $fixedAsset,
            'is_stock_item'   => ! $fixedAsset,
        ]);

        $variant = $fixedAsset
            ? null
            : ItemVariantFactory::new()->for($item, 'item')->create(['is_stock_item' => true]);
        $asset = $fixedAsset
            ? Asset::factory()->create(['item_id' => $item->id])
            : null;

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $itemUnitId,
            'item_id'    => $item->id,
            'unit_id'    => $variant?->default_unit_id ?? $item->default_unit_id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['item_id' => $variant?->id, 'asset_id' => $asset?->id, 'unit_id' => $itemUnitId];
    }

    /**
     * @return array<string,mixed>
     */
    private function row(array $fixture, float $quantity, float $price, ?string $id = null): array {
        return [
            'id' => $id ?? (string) Str::ulid(),
            ...($fixture['asset_id'] ? [] : ['unit' => ['id' => $fixture['unit_id']]]),
            'tax'      => ['id' => $this->tax->id],
            'quantity' => $quantity,
            'price'    => $price,
            ...($fixture['asset_id']
                ? ['asset' => ['id' => $fixture['asset_id']]]
                : ['item' => ['id' => $fixture['item_id']], 'source_warehouse' => ['id' => $this->warehouseId]]),
        ];
    }

    /**
     * @param  array<string,mixed>  $lists  ['items' => [...], 'asset_items' => [...]]
     * @return array<string,mixed>
     */
    private function payload(array $lists): array {
        $country        = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer       = CustomerFactory::new()->create(['country_id' => $country->code]);
        $customerBranch = Branch::where('branchable_type', Customer::class)
            ->where('branchable_id', $customer->id)
            ->where('is_main_branch', true)
            ->firstOrFail();

        return [
            'customer'          => ['id' => $customer->id],
            'customer_branch'   => ['id' => $customerBranch->id],
            'branch'            => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'              => now()->toDateString(),
            'payment_schedules' => [],
            ...$lists,
        ];
    }

    #[Test]
    public function create_saves_items_and_asset_items_in_the_same_table_and_totals_both(): void {
        $regular = $this->createItemWithUnit(false);
        $asset   = $this->createItemWithUnit(true);

        $salesOrder = app(SalesOrderService::class)->create($this->payload([
            'items'       => [$this->row($regular, 2, 100000)],
            'asset_items' => [$this->row($asset, 1, 500000)],
        ]));

        $salesOrder = $salesOrder->fresh(['items']);

        $this->assertSame(2, SalesOrderItem::where('sales_order_id', $salesOrder->id)->count());
        $this->assertCount(2, $salesOrder->items, 'relasi items() tetap mengembalikan SEMUA baris');
        $this->assertEqualsWithDelta((200000 + 500000) * 1.11, (float) $salesOrder->amount, 0.01);
        $this->assertEqualsWithDelta(700000, $salesOrder->items->sum('basic_amount'), 0.01);
    }

    #[Test]
    public function create_with_only_asset_items_works(): void {
        $asset = $this->createItemWithUnit(true);

        $salesOrder = app(SalesOrderService::class)->create($this->payload([
            'asset_items' => [$this->row($asset, 2, 250000)],
        ]))->fresh(['items']);

        $this->assertCount(1, $salesOrder->items);
        $this->assertNull($salesOrder->items->first()->item_unit_id);
        $this->assertSame(1.0, $salesOrder->items->first()->conversion_factor);
        $this->assertEqualsWithDelta(500000 * 1.11, (float) $salesOrder->amount, 0.01);
    }

    #[Test]
    public function submit_accepts_a_rentable_asset_as_the_rental_line(): void {
        $asset = $this->createItemWithUnit(true);
        Asset::query()->findOrFail($asset['asset_id'])->update(['is_rentable' => true]);

        $salesOrder = app(SalesOrderService::class)->create($this->payload([
            'is_rent'     => true,
            'rent_date'   => ['from' => now()->toDateString(), 'to' => now()->addDay()->toDateString()],
            'asset_items' => [$this->row($asset, 1, 250000)],
        ]));
        $branch = Branch::create(['name' => 'Submit Branch', 'code' => 'SB']);
        $salesOrder->update(['branch_id' => $branch->id]);
        $salesOrder->setRelation('branch', $branch);

        $approvalService = \Mockery::mock(ApprovalService::class);
        $approvalService->shouldReceive('check')->once()->andReturn(null);
        app()->instance(ApprovalService::class, $approvalService);

        app(SalesOrderService::class)->submit($salesOrder);

        $this->assertTrue($salesOrder->fresh()->is_rent);
    }

    #[Test]
    public function create_without_asset_items_behaves_exactly_as_before(): void {
        $regular = $this->createItemWithUnit(false);

        $salesOrder = app(SalesOrderService::class)->create($this->payload([
            'items' => [$this->row($regular, 3, 100000)],
        ]))->fresh(['items']);

        $this->assertCount(1, $salesOrder->items);
        $this->assertEqualsWithDelta(300000 * 1.11, (float) $salesOrder->amount, 0.01);
    }

    #[Test]
    public function update_merges_both_lists_and_removes_rows_missing_from_the_payload(): void {
        $regular = $this->createItemWithUnit(false);
        $assetA  = $this->createItemWithUnit(true);
        $assetB  = $this->createItemWithUnit(true);
        $service = app(SalesOrderService::class);

        $created = $service->create($this->payload([
            'items'       => [$this->row($regular, 1, 100000)],
            'asset_items' => [$this->row($assetA, 1, 400000)],
        ]))->fresh(['items']);

        $regularRow = $created->items->firstWhere('item_id', $regular['item_id']);

        $service->update($created, $this->payload([
            // baris reguler lama dipertahankan (id sama), baris aset A dibuang, aset B baru
            'items'       => [$this->row($regular, 1, 100000, $regularRow->id)],
            'asset_items' => [$this->row($assetB, 1, 300000)],
        ]));

        $rows = SalesOrderItem::where('sales_order_id', $created->id)->get();

        $this->assertCount(2, $rows);
        $this->assertNotNull($rows->firstWhere('id', $regularRow->id), 'baris reguler lama tetap ada');
        $this->assertNull($rows->firstWhere('asset_id', $assetA['asset_id']), 'baris aset A dihapus');
        $this->assertNotNull($rows->firstWhere('asset_id', $assetB['asset_id']), 'baris aset B ditambahkan');
        $this->assertEqualsWithDelta((100000 + 300000) * 1.11, (float) $created->fresh()->amount, 0.01);
    }

    /**
     * Property 5: untuk payload acak tanpa baris aset, hasil create identik apa pun
     * bentuk key `asset_items` (tidak ada / kosong) dan sama dengan oracle
     * Σ(quantity × price) × (1 + PPN).
     */
    #[Test]
    public function property_5_documents_without_asset_rows_are_unaffected_by_the_asset_items_key(): void {
        mt_srand(5005);
        $service = app(SalesOrderService::class);

        for ($iteration = 0; $iteration < 8; $iteration++) {
            $rows     = [];
            $expected = 0.0;
            for ($i = 0, $count = mt_rand(1, 4); $i < $count; $i++) {
                $quantity = mt_rand(1, 5);
                $price    = [1000, 2500, 40000, 125000][mt_rand(0, 3)];
                $rows[]   = $this->row($this->createItemWithUnit(false), $quantity, $price);
                $expected += $quantity * $price * 1.11;
            }

            $lists = $iteration % 2 === 0 ? ['items' => $rows] : ['items' => $rows, 'asset_items' => []];

            $salesOrder = $service->create($this->payload($lists))->fresh(['items']);

            $this->assertCount(\count($rows), $salesOrder->items, "iterasi {$iteration}: jumlah baris");
            $this->assertEqualsWithDelta($expected, (float) $salesOrder->amount, 0.05, "iterasi {$iteration}: total dokumen");
        }
    }
}
