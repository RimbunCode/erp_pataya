<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Http\Requests\Purchase\PurchaseReceiptRequest;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec purchase-receipt-off-po-items, Requirement 2: validasi baris item di
 * luar PO (substitusi / berdiri sendiri) pada PurchaseReceiptRequest.
 */
class PurchaseReceiptRequestOffPoTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Supplier $supplier;
    private Warehouse $warehouse;
    private PurchaseOrder $po;
    private PurchaseOrderItem $poItem;
    private ItemVariant $poVariant;
    private ItemVariant $otherVariant;
    private ItemUnit $itemUnit;

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

        $this->user      = User::factory()->create();
        $this->supplier  = SupplierFactory::new()->create();
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        $item               = ItemFactory::new()->create();
        $this->poVariant    = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $this->otherVariant = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit               = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $this->itemUnit     = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);

        $this->po     = $this->makePo();
        $this->poItem = $this->makePoItem($this->po, $this->poVariant, 10);
    }

    private function makePo(): PurchaseOrder {
        return BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $this->supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
    }

    private function makePoItem(PurchaseOrder $po, ItemVariant $variant, float $quantity, float $received = 0): PurchaseOrderItem {
        return PurchaseOrderItem::create([
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'received_quantity'   => $received,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
        ]);
    }

    private function row(array $over = []): array {
        return array_merge([
            'id'       => (string) Str::ulid(),
            'quantity' => 5,
            'unit'     => ['id' => $this->itemUnit->id],
        ], $over);
    }

    private function normalRow(array $over = []): array {
        return $this->row(array_merge(['purchase_order_item_id' => $this->poItem->id], $over));
    }

    private function offPoRow(array $over = []): array {
        return $this->row(array_merge([
            'item'             => ['id' => $this->otherVariant->id],
            'target_warehouse' => ['id' => $this->warehouse->id],
        ], $over));
    }

    private function validate(array $items, array $extra = []): Validator {
        $data = array_merge([
            'date'           => now()->toDateString(),
            'purchase_order' => ['id' => $this->po->id],
            'supplier'       => ['id' => $this->supplier->id],
            'items'          => $items,
        ], $extra);

        $request   = PurchaseReceiptRequest::create('/', 'POST', $data);
        $validator = ValidatorFacade::make($data, $request->rules());
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    private function assertErrorOn(Validator $validator, string $key): void {
        $this->assertTrue($validator->fails(), 'Diharapkan validasi gagal.');
        $this->assertArrayHasKey($key, $validator->errors()->toArray(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_normal_row_unchanged(): void {
        $validator = $this->validate([$this->normalRow()]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function zero_receipt_tolerance_rejects_quantity_over_the_source_remaining(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 0]);

        $validator = $this->validate([$this->normalRow(['quantity' => 11])]);

        $this->assertErrorOn($validator, 'items.0.quantity');
    }

    #[Test]
    public function positive_receipt_tolerance_allows_the_configured_overage(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 10]);

        $validator = $this->validate([$this->normalRow(['quantity' => 11])]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function null_receipt_tolerance_does_not_add_a_source_quantity_limit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => null]);

        $validator = $this->validate([$this->normalRow(['quantity' => 11])]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_standalone_off_po_row(): void {
        $validator = $this->validate([$this->offPoRow()]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function accepts_substitution_row(): void {
        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
            'replaced_quantity'               => 5,
        ])]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_row_without_po_item_and_without_item(): void {
        $validator = $this->validate([$this->row(['target_warehouse' => ['id' => $this->warehouse->id]])]);

        $this->assertErrorOn($validator, 'items.0.purchase_order_item_id');
        $this->assertArrayHasKey('items.0.item.id', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_off_po_row_without_target_warehouse(): void {
        $row = $this->offPoRow();
        unset($row['target_warehouse']);

        $this->assertErrorOn($this->validate([$row]), 'items.0.target_warehouse.id');
    }

    #[Test]
    public function rejects_unknown_item_variant(): void {
        $validator = $this->validate([$this->offPoRow(['item' => ['id' => (string) Str::ulid()]])]);

        $this->assertErrorOn($validator, 'items.0.item.id');
    }

    #[Test]
    public function rejects_replaces_on_a_row_that_already_has_po_item(): void {
        $validator = $this->validate([$this->normalRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
            'replaced_quantity'               => 1,
        ])]);

        $this->assertErrorOn($validator, 'items.0.replaces_purchase_order_item_id');
    }

    #[Test]
    public function rejects_replaces_without_replaced_quantity(): void {
        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
        ])]);

        $this->assertErrorOn($validator, 'items.0.replaced_quantity');
    }

    #[Test]
    public function rejects_non_positive_replaced_quantity(): void {
        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
            'replaced_quantity'               => 0,
        ])]);

        $this->assertErrorOn($validator, 'items.0.replaced_quantity');
    }

    #[Test]
    public function rejects_replaced_po_item_from_another_purchase_order(): void {
        $otherPo     = $this->makePo();
        $otherPoItem = $this->makePoItem($otherPo, ItemVariantFactory::new()->create(['item_id' => $this->poVariant->item_id]), 10);

        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $otherPoItem->id,
            'replaced_quantity'               => 1,
        ])]);

        $this->assertErrorOn($validator, 'items.0.replaces_purchase_order_item_id');
    }

    #[Test]
    public function rejects_off_po_item_that_is_already_a_po_item_anti_bypass(): void {
        $validator = $this->validate([$this->offPoRow(['item' => ['id' => $this->poVariant->id]])]);

        $this->assertErrorOn($validator, 'items.0.item.id');
    }

    #[Test]
    public function rejects_replaced_quantity_exceeding_remaining_of_po_item(): void {
        $this->poItem->update(['received_quantity' => 8]); // sisa 2

        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
            'replaced_quantity'               => 3,
        ])]);

        $this->assertErrorOn($validator, 'items.0.replaced_quantity');
    }

    #[Test]
    public function rejects_sum_of_replaced_quantity_across_rows_exceeding_remaining(): void {
        $thirdVariant = ItemVariantFactory::new()->create(['item_id' => $this->poVariant->item_id]);

        $validator = $this->validate([
            $this->offPoRow(['replaces_purchase_order_item_id' => $this->poItem->id, 'replaced_quantity' => 6]),
            $this->offPoRow([
                'item'                            => ['id' => $thirdVariant->id],
                'replaces_purchase_order_item_id' => $this->poItem->id,
                'replaced_quantity'               => 6,
            ]),
        ]);

        $this->assertErrorOn($validator, 'items.1.replaced_quantity');
        $this->assertArrayNotHasKey('items.0.replaced_quantity', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_replaced_quantity_equal_to_remaining(): void {
        $this->poItem->update(['received_quantity' => 4]); // sisa 6

        $validator = $this->validate([$this->offPoRow([
            'replaces_purchase_order_item_id' => $this->poItem->id,
            'replaced_quantity'               => 6,
        ])]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function return_receipts_skip_off_po_cross_row_rules(): void {
        $original = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));

        // Item sudah ada di PO + melebihi sisa: tetap lolos karena ini retur.
        $validator = $this->validate(
            [$this->offPoRow(['item' => ['id' => $this->poVariant->id], 'replaced_quantity' => 999, 'replaces_purchase_order_item_id' => $this->poItem->id])],
            ['return_against' => ['id' => $original->id]],
        );

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }
}
