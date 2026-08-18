<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DeliveryNoteServiceAssetServiceConsumedItemTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, StockLedgerEntry::class] as $model) {
            $model::initPermissions();
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeItemVariantWithStock(float $quantity = 10): ItemVariant {
        $item        = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unit        = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit    = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $branch      = Branch::create(['name' => 'Test Branch', 'is_main_branch' => true]);

        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Test Warehouse',
            'code'      => 'WH-' . fake()->unique()->numerify('####'),
        ]);

        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => $quantity,
            'conversion_factor' => 1,
            'stock_queue'       => [['quantity' => $quantity, 'rate' => 1000]],
        ]);

        $itemVariant->setRelation('sourceWarehouse', $warehouse);
        $itemVariant->source_warehouse_id = $warehouse->id;

        return $itemVariant;
    }

    private function makeApprovedConsumedItem(float $quantity = 5): AssetServiceConsumedItem {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);

        return AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'quantity'         => $quantity,
        ]);
    }

    private function makeDeliveryNote(SalesOrderItem $soItem, ItemVariant $itemVariant, float $quantity): DeliveryNote {
        SalesOrder::initPermissions();
        DeliveryNote::initPermissions();

        $deliveryNote = DeliveryNote::create([
            'code'            => fake()->unique()->bothify('DN-####'),
            'delivery_date'   => now(),
            'reference_to_id' => Permission::create([
                'module' => 'inventory',
                'name'   => 'dn_asc_' . fake()->unique()->numerify('####'),
                'model'  => DeliveryNote::class,
            ])->id,
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $soItem->sales_order_id,
            'created_by_id'      => $soItem->salesOrder->created_by_id,
        ]);

        DeliveryNoteItem::create([
            'delivery_note_id'    => $deliveryNote->id,
            'item_id'             => $itemVariant->id,
            'referenceable_type'  => SalesOrderItem::class,
            'referenceable_id'    => $soItem->id,
            'source_warehouse_id' => $itemVariant->source_warehouse_id,
            'quantity'            => $quantity,
            'valuation_rates'     => [],
        ]);

        return $deliveryNote;
    }

    #[Test]
    public function dn_approve_part_line_deducts_stock_via_standard_ledger(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);

        $consumedItem = $this->makeApprovedConsumedItem(5);
        $itemVariant  = $this->makeItemVariantWithStock(10);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'X', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        $soItem = SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => $itemVariant->id,
            'quantity'           => 5,
            'price'              => 0,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        $deliveryNote = $this->makeDeliveryNote($soItem, $itemVariant, 5);

        (new DeliveryNoteService)->onApproved($deliveryNote->fresh());

        $this->assertSame(1, StockLedgerEntry::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)
            ->count());

        $entry = StockLedgerEntry::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)
            ->first();
        $this->assertEqualsWithDelta(-5.0, (float) $entry->quantity_change, 0.0001);
    }

    #[Test]
    public function service_line_does_not_trigger_any_stock_ledger(): void {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $itemVariant  = $this->makeItemVariantWithStock(10);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Y', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        $soItem = SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => $itemVariant->id,
            'quantity'           => 1,
            'price'              => 0,
            'referenceable_type' => AssetService::class,
            'referenceable_id'   => $assetService->id,
        ]);

        $deliveryNote = $this->makeDeliveryNote($soItem, $itemVariant, 1);

        (new DeliveryNoteService)->onApproved($deliveryNote->fresh());

        $this->assertSame(0, StockLedgerEntry::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNote->id)
            ->count());

        $stock = Stock::where('item_variant_id', $itemVariant->id)->first();
        $this->assertEqualsWithDelta(10.0, $stock->quantity, 0.0001);
    }
}
