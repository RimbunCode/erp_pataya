<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Task 5.6 — Dispatch Correctness: FixedAssetItemApproved dipicu tepat untuk
 * item fixed-asset saja saat PurchaseReceiptService::onApproved() dipanggil
 * lewat jalur penuh (bukan cuma listener langsung seperti
 * CreateAssetFromPurchaseListenerTest), termasuk skenario >1 fixed-asset item
 * dalam satu dokumen (lihat diskusi user soal multi-item per purchase).
 */
class PurchaseReceiptServiceFixedAssetDispatchTest extends TestCase {
    use RefreshDatabase;

    private PurchaseReceiptService $service;
    private User $testUser;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new PurchaseReceiptService;

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([
            FormatingSeries::class,
            Supplier::class,
            PurchaseOrder::class,
            PurchaseReceipt::class,
            StockLedgerEntry::class,
        ] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        CountryFactory::new()->create(['code' => 'IDN']);
        $this->testUser = User::factory()->create();
    }

    private function withoutModelEvents(callable $callback) {
        return BaseModel::withoutEvents($callback);
    }

    /**
     * ItemVariant::defaultUom() mencocokkan ItemUnit.unit_id ==
     * ItemVariant.default_unit_id (ItemUnit.item_id tetap FK ke Item, BUKAN
     * ItemVariant) — ItemVariantFactory tidak otomatis mengisi default_unit_id,
     * jadi test harus menyediakannya eksplisit (production selalu terisi lewat
     * alur create Item normal).
     */
    private function makeDefaultUom(Item $item, ItemVariant $itemVariant): ItemUnit {
        $unit = Unit::create([
            'code'              => 'PCS-' . fake()->unique()->numerify('####'),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $itemVariant->update(['default_unit_id' => $unit->id]);

        return $itemUnit;
    }

    private function makePoItem(Item $item, float $quantity, string $warehouseId): PurchaseOrderItem {
        $variant = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $this->makeDefaultUom($item, $variant);
        $supplier = SupplierFactory::new()->create();

        $this->actingAs($this->testUser);
        $po = $this->withoutModelEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        return PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'rate'                => 1000,
            'target_warehouse_id' => $warehouseId,
        ]);
    }

    #[Test]
    public function dispatches_event_only_for_fixed_asset_items_among_mixed_items(): void {
        Event::fake([FixedAssetItemApproved::class]);

        $warehouse = WarehouseFactory::new()->create();

        $fixedAssetItemA = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $fixedAssetItemB = ItemFactory::new()->create(['is_fixed_asset' => true]);
        $regularItem     = ItemFactory::new()->create(['is_fixed_asset' => false]);

        $poItemA = $this->makePoItem($fixedAssetItemA, 1, $warehouse->id);
        $poItemB = $this->makePoItem($fixedAssetItemB, 1, $warehouse->id);
        $poItemC = $this->makePoItem($regularItem, 5, $warehouse->id);

        $receipt = $this->withoutModelEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $poItemA->purchase_order_id,
            'created_by_id'     => $this->testUser->id,
        ]));

        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItemA->id,
            'item_id'                => $poItemA->item_id,
            'quantity'               => 1,
            'target_warehouse_id'    => $warehouse->id,
        ]);
        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItemB->id,
            'item_id'                => $poItemB->item_id,
            'quantity'               => 1,
            'target_warehouse_id'    => $warehouse->id,
        ]);
        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItemC->id,
            'item_id'                => $poItemC->item_id,
            'quantity'               => 5,
            'target_warehouse_id'    => $warehouse->id,
        ]);

        $this->service->onApproved($receipt);

        Event::assertDispatchedTimes(FixedAssetItemApproved::class, 2);
        Event::assertDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($fixedAssetItemA));
        Event::assertDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($fixedAssetItemB));
        Event::assertNotDispatched(FixedAssetItemApproved::class, fn ($e) => $e->item->is($regularItem));
    }

    #[Test]
    public function does_not_dispatch_event_when_no_fixed_asset_items(): void {
        Event::fake([FixedAssetItemApproved::class]);

        $warehouse   = WarehouseFactory::new()->create();
        $regularItem = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $poItem      = $this->makePoItem($regularItem, 2, $warehouse->id);

        $receipt = $this->withoutModelEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $poItem->purchase_order_id,
            'created_by_id'     => $this->testUser->id,
        ]));

        PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => 2,
            'target_warehouse_id'    => $warehouse->id,
        ]);

        $this->service->onApproved($receipt);

        Event::assertNotDispatched(FixedAssetItemApproved::class);
    }
}
