<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\PurchaseReceiptOffPoItem;
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
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec purchase-invoice-off-po-items, Requirement 8.1: dropdown baris receipt di
 * luar PO (sub model LinkModel invoice) lewat route `model`.
 */
class PurchaseReceiptOffPoItemLinkModelTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private PurchaseOrder $po;
    private PurchaseOrder $otherPo;
    private ItemVariant $variant;
    private ItemUnit $itemUnit;
    private $warehouse;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class] as $model) {
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

        $this->withoutMiddleware();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
        $this->warehouse = WarehouseFactory::new()->create();

        $item           = ItemFactory::new()->create();
        $this->variant  = ItemVariantFactory::new()->create(['item_id' => $item->id, 'code' => 'ZZ-OFFPO-V1']);
        $unit           = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $this->itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);

        $supplier      = SupplierFactory::new()->create();
        $this->po      = $this->makePo($supplier);
        $this->otherPo = $this->makePo($supplier);
    }

    private function makePo(Supplier $supplier): PurchaseOrder {
        return BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
    }

    private function makeRow(PurchaseOrder $po, array $over = [], bool $approved = true): PurchaseReceiptItem {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $po->id,
            'created_by_id'     => $this->user->id,
        ]));
        if ($approved) {
            $receipt->forceFill(['submitted_at' => now(), 'status' => [FormStatus::RECEIVED]])->save();
        }

        return PurchaseReceiptItem::create(array_merge([
            'purchase_receipt_id' => $receipt->id,
            'purchase_order_id'   => $po->id,
            'item_id'             => $this->variant->id,
            'item_unit_id'        => $this->itemUnit->id,
            'quantity'            => 5,
            'target_warehouse_id' => $this->warehouse->id,
        ], $over));
    }

    private function lookup(array $payload): array {
        $response = $this->postJson(route('model'), array_merge([
            'model'   => PurchaseReceiptOffPoItem::class,
            'search'  => '',
            'limit'   => 50,
            'filters' => ['purchase_order_id' => $this->po->id],
        ], $payload), ['X-Requested-With' => 'XMLHttpRequest']);
        $response->assertOk();

        return $response->json('data');
    }

    #[Test]
    public function lists_only_standalone_rows_of_approved_receipts_of_the_given_po(): void {
        $standalone = $this->makeRow($this->po);
        $this->makeRow($this->otherPo); // PO lain
        $this->makeRow($this->po, approved: false); // receipt belum di-approve
        $poItem = PurchaseOrderItem::create(['purchase_order_id' => $this->po->id, 'item_id' => $this->variant->id, 'quantity' => 1, 'rate' => 1, 'target_warehouse_id' => $this->warehouse->id]);
        $this->makeRow($this->po, ['purchase_order_item_id' => $poItem->id]); // baris normal
        $this->makeRow($this->po, ['replaces_purchase_order_item_id' => $poItem->id, 'replaced_quantity' => 1]); // pengganti

        $rows = $this->lookup([]);

        $this->assertSame([$standalone->id], array_column($rows, 'id'));
        $this->assertSame(PurchaseReceiptOffPoItem::class, $rows[0]['thisModel']);
    }

    #[Test]
    public function search_matches_item_code(): void {
        $this->makeRow($this->po);

        $this->assertCount(1, $this->lookup(['search' => 'OFFPO-V1']));
        $this->assertCount(0, $this->lookup(['search' => 'tidak-ada-item-ini']));
    }

    #[Test]
    public function service_create_fills_purchase_order_id_on_rows(): void {
        $supplier = $this->po->supplier;
        $receipt  = (new PurchaseReceiptService)->create([
            'date'           => now()->toDateString(),
            'branch'         => ['code' => 'MAIN'],
            'purchase_order' => ['id' => $this->po->id],
            'supplier'       => ['id' => $supplier->id],
            'items'          => [[
                'id'               => 'r1',
                'item'             => ['id' => $this->variant->id],
                'quantity'         => 2,
                'unit'             => ['id' => $this->itemUnit->id],
                'target_warehouse' => ['id' => $this->warehouse->id],
            ]],
        ]);

        $this->assertSame($this->po->id, $receipt->items()->first()->purchase_order_id);
    }
}
