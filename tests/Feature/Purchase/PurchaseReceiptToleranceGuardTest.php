<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Http\Requests\Purchase\PurchaseReceiptRequest;
use App\Models\Asset\Asset;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec module-defaults-and-controls, Requirement 7.1/7.4: toleransi penerimaan berlebih per PO Item
 * dijumlahkan lintas baris normal dan baris pengganti dalam satu dokumen, dan dibandingkan dalam
 * satu satuan (received_quantity disimpan dalam satuan stok). Simpan (request) dan approve (service).
 */
class PurchaseReceiptToleranceGuardTest extends TestCase {
    use RefreshDatabase;

    private PurchaseReceiptService $service;
    private User $user;
    private Supplier $supplier;
    private Warehouse $warehouse;
    private PurchaseOrder $po;
    private PurchaseOrderItem $xItem;
    private ItemVariant $xVariant;
    private ItemVariant $yVariant;
    private ItemUnit $xUnit;
    private ItemUnit $yUnit;
    private ItemUnit $boxUnit;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new PurchaseReceiptService;

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class, StockLedgerEntry::class, Asset::class] as $model) {
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

        Event::fake([
            PurchaseReceiptGeneralLedgerPostingRequested::class,
            PurchaseOrderReceiveStatusRecalculationRequested::class,
            PurchaseRequestReceiveStatusRecalculationRequested::class,
            FixedAssetItemApproved::class,
        ]);

        $this->user      = User::factory()->create();
        $this->supplier  = SupplierFactory::new()->create();
        $this->warehouse = WarehouseFactory::new()->create();
        $this->actingAs($this->user);

        [$this->xVariant, $this->xUnit] = $this->makeVariant();
        [$this->yVariant, $this->yUnit] = $this->makeVariant();

        // Satuan "box" (1 box = 12 satuan dasar) untuk item X; satuan dasar tetap default.
        $box           = Unit::create(['code' => 'BOX-' . fake()->unique()->numerify('####'), 'name' => 'Box', 'conversion_factor' => 12, 'is_default' => false]);
        $this->boxUnit = ItemUnit::create(['item_id' => $this->xVariant->item_id, 'unit_id' => $box->id, 'conversion_factor' => 12, 'is_default' => false]);

        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $this->supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
        $this->xItem = PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $this->xVariant->id,
            'quantity'            => 10,
            'rate'                => 1000,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $this->xUnit->id,
        ]);
    }

    /** @return array{0: ItemVariant, 1: ItemUnit} */
    private function makeVariant(): array {
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit     = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $variant->update(['default_unit_id' => $unit->id]);

        return [$variant, $itemUnit];
    }

    /** PO Item X dalam satuan box (cf 12): 10 box, sudah diterima 5 box = 60 satuan stok. */
    private function useBoxPurchaseOrderItem(float $quantity = 10, float $receivedInStockUnits = 60): void {
        $this->xItem->update([
            'quantity'          => $quantity,
            'received_quantity' => $receivedInStockUnits,
            'item_unit_id'      => $this->boxUnit->id,
            'conversion_factor' => 12,
        ]);
    }

    /** @return array<string, mixed> */
    private function normalRow(float $quantity, ?ItemUnit $unit = null): array {
        return [
            'id'                     => (string) Str::ulid(),
            'purchase_order_item_id' => $this->xItem->id,
            'quantity'               => $quantity,
            'unit'                   => ['id' => ($unit ?? $this->xUnit)->id],
        ];
    }

    /** @return array<string, mixed> */
    private function substitutionRow(float $quantity, float $replacedQuantity): array {
        return [
            'id'                              => (string) Str::ulid(),
            'item'                            => ['id' => $this->yVariant->id],
            'target_warehouse'                => ['id' => $this->warehouse->id],
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => $replacedQuantity,
            'quantity'                        => $quantity,
            'unit'                            => ['id' => $this->yUnit->id],
        ];
    }

    private function validate(array $items): Validator {
        $data = [
            'date'           => now()->toDateString(),
            'purchase_order' => ['id' => $this->po->id],
            'supplier'       => ['id' => $this->supplier->id],
            'items'          => $items,
        ];

        $request   = PurchaseReceiptRequest::create('/', 'POST', $data);
        $validator = ValidatorFacade::make($data, $request->rules());
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    private function receiptWith(array $rows): PurchaseReceipt {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ]));
        foreach ($rows as $row) {
            PurchaseReceiptItem::create(array_merge([
                'purchase_receipt_id' => $receipt->id,
                'target_warehouse_id' => $this->warehouse->id,
            ], $row));
        }

        return $receipt;
    }

    /** @return array<string, mixed> */
    private function normalReceiptRow(float $quantity, ?ItemUnit $unit = null, float $factor = 1): array {
        return [
            'purchase_order_item_id' => $this->xItem->id,
            'item_id'                => $this->xVariant->id,
            'item_unit_id'           => ($unit ?? $this->xUnit)->id,
            'conversion_factor'      => $factor,
            'quantity'               => $quantity,
        ];
    }

    /** @return array<string, mixed> */
    private function substitutionReceiptRow(float $quantity, float $replacedQuantity): array {
        return [
            'item_id'                         => $this->yVariant->id,
            'item_unit_id'                    => $this->yUnit->id,
            'quantity'                        => $quantity,
            'replaces_purchase_order_item_id' => $this->xItem->id,
            'replaced_quantity'               => $replacedQuantity,
        ];
    }

    // --- A: kelebihan terima dihitung ganda dalam satu dokumen ----------------------

    #[Test]
    public function request_sums_normal_and_substituted_quantity_of_the_same_po_item_into_one_limit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 10]);

        // Batas 10 x 1,1 = 11. Masing-masing 11 lolos sendiri-sendiri, namun total 22.
        $validator = $this->validate([$this->normalRow(11), $this->substitutionRow(11, 11)]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.quantity', $validator->errors()->toArray());
    }

    #[Test]
    public function request_allows_normal_plus_substituted_quantity_up_to_the_limit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 10]);

        $within = $this->validate([$this->normalRow(6), $this->substitutionRow(5, 5)]);
        $this->assertFalse($within->fails(), json_encode($within->errors()->toArray()));

        $over = $this->validate([$this->normalRow(6), $this->substitutionRow(6, 6)]);
        $this->assertTrue($over->fails());
    }

    #[Test]
    public function request_strict_zero_tolerance_sums_both_row_kinds(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 0]);

        $this->assertFalse($this->validate([$this->normalRow(5), $this->substitutionRow(5, 5)])->fails());
        $this->assertTrue($this->validate([$this->normalRow(5), $this->substitutionRow(6, 6)])->fails());
    }

    #[Test]
    public function request_with_null_tolerance_keeps_the_existing_neutral_behaviour(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => null]);

        $validator = $this->validate([$this->normalRow(15), $this->substitutionRow(3, 3)]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function approval_sums_normal_and_substituted_quantity_of_the_same_po_item_under_lock(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 10]);
        $receipt = $this->receiptWith([$this->normalReceiptRow(11), $this->substitutionReceiptRow(11, 11)]);

        try {
            $this->service->onApproved($receipt);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items', $exception->errors());
        }

        $this->assertSame(0.0, $this->xItem->fresh()->received_quantity);
    }

    #[Test]
    public function approval_allows_the_combined_quantity_within_the_limit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 10]);
        $receipt = $this->receiptWith([$this->normalReceiptRow(6), $this->substitutionReceiptRow(5, 5)]);

        $this->service->onApproved($receipt);

        $this->assertEquals(11, $this->xItem->fresh()->received_quantity);
    }

    // --- C: satuan PO Item vs satuan stok ----------------------------------------------

    #[Test]
    public function request_compares_tolerance_in_one_unit_when_po_unit_differs_from_stock_unit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 0]);
        $this->useBoxPurchaseOrderItem();

        // 10 box dipesan, 5 box (60 satuan stok) sudah diterima: sisa 5 box.
        $fits = $this->validate([$this->normalRow(5, $this->boxUnit)]);
        $this->assertFalse($fits->fails(), json_encode($fits->errors()->toArray()));

        $over = $this->validate([$this->normalRow(6, $this->boxUnit)]);
        $this->assertTrue($over->fails());
        $message = $over->errors()->first('items.0.quantity');
        $this->assertStringContainsString('5', $message, 'Sisa/batas ditampilkan dalam satuan PO Item (box).');
    }

    #[Test]
    public function request_strict_tolerance_still_rejects_over_receipt_in_a_different_unit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 0]);
        $this->useBoxPurchaseOrderItem(10, 0);

        // 11 box > 10 box; dalam satuan dasar 132 > 120.
        $this->assertTrue($this->validate([$this->normalRow(11, $this->boxUnit)])->fails());
        $this->assertFalse($this->validate([$this->normalRow(10, $this->boxUnit)])->fails());
        // Receipt dalam satuan dasar: 120 satuan dasar = 10 box.
        $this->assertFalse($this->validate([$this->normalRow(120)])->fails());
        $this->assertTrue($this->validate([$this->normalRow(121)])->fails());
    }

    #[Test]
    public function approval_compares_tolerance_in_one_unit_when_po_unit_differs_from_stock_unit(): void {
        PurchaseSetting::current()->update(['over_receipt_tolerance_percent' => 0]);
        $this->useBoxPurchaseOrderItem();

        $over = $this->receiptWith([$this->normalReceiptRow(6, $this->boxUnit, 12)]);
        try {
            $this->service->onApproved($over);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items', $exception->errors());
        }
        $this->assertEquals(60, $this->xItem->fresh()->received_quantity);

        $fits = $this->receiptWith([$this->normalReceiptRow(5, $this->boxUnit, 12)]);
        $this->service->onApproved($fits);
        $this->assertEquals(120, $this->xItem->fresh()->received_quantity, 'received_quantity tetap dalam satuan stok (perilaku yang ada).');
    }
}
