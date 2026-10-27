<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Http\Requests\Inventory\DeliveryNoteRequest;
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
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec module-defaults-and-controls, Requirement 7.1/7.4: toleransi pengiriman (over_delivery_tolerance_percent)
 * berlaku untuk baris Delivery Note dari Sales Order dan Internal Order (semua jenis baris), saat simpan
 * dan saat approve di bawah lock. Retur dikecualikan; toleransi null netral.
 */
class DeliveryNoteDeliveryToleranceTest extends TestCase {
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

    private function makeItemVariantWithStock(float $quantity = 20): ItemVariant {
        $item        = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unit        = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit    = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $branch      = Branch::create(['name' => 'Test Branch', 'is_main_branch' => true]);
        $warehouse   = Warehouse::create(['branch_id' => $branch->id, 'name' => 'Test Warehouse', 'code' => 'WH-' . fake()->unique()->numerify('####')]);

        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => $quantity,
            'conversion_factor' => 1,
            'stock_queue'       => [['quantity' => $quantity, 'rate' => 1000]],
        ]);
        $itemVariant->source_warehouse_id = $warehouse->id;

        return $itemVariant;
    }

    private function makeInternalOrder(): InternalOrder {
        InternalOrder::initPermissions();

        return InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);
    }

    /** Baris IO biasa (tanpa referensi servis/part). */
    private function plainInternalOrderItem(float $quantity = 10, float $delivered = 0, ?ItemVariant $variant = null): InternalOrderItem {
        return InternalOrderItem::create([
            'internal_order_id'  => $this->makeInternalOrder()->id,
            'item_id'            => ($variant ?? ItemVariant::factory()->create())->id,
            'quantity'           => $quantity,
            'delivered_quantity' => $delivered,
        ]);
    }

    private function makeSalesOrderItem(float $quantity = 10, float $delivered = 0): SalesOrderItem {
        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        return SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => $quantity,
            'delivered_quantity' => $delivered,
            'price'              => 0,
        ]);
    }

    /** @param  array<string, mixed>  $extra */
    private function validate(array $items, array $extra = []): Validator {
        $data      = ['items' => $items, ...$extra];
        $validator = ValidatorFacade::make($data, [
            'items.*.referenceable_type' => ['nullable', 'string'],
            'items.*.referenceable_id'   => ['nullable', 'string'],
            'items.*.quantity'           => ['nullable', 'numeric'],
        ]);

        $request = DeliveryNoteRequest::create('/', 'POST', $data);
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    /** @return array<string, mixed> */
    private function row(string $type, string $sourceId, float $quantity): array {
        return [
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => $type,
            'referenceable_id'   => $sourceId,
            'quantity'           => $quantity,
            'source_warehouse'   => ['id' => 'w1'],
            'unit'               => ['id' => 'u1'],
        ];
    }

    // --- simpan ---------------------------------------------------------------------

    #[Test]
    public function request_rejects_internal_order_quantity_over_the_tolerance_limit(): void {
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 10]);
        $ioItem = $this->plainInternalOrderItem(10);

        $this->assertArrayNotHasKey('items.0.quantity', $this->validate([$this->row(InternalOrderItem::class, $ioItem->id, 11)])->errors()->toArray());

        $over = $this->validate([$this->row(InternalOrderItem::class, $ioItem->id, 12)]);
        $this->assertArrayHasKey('items.0.quantity', $over->errors()->toArray());
        $this->assertStringContainsString('11', $over->errors()->first('items.0.quantity'), 'Pesan menyebut batas (sisa + toleransi).');
    }

    #[Test]
    public function request_counts_what_was_already_delivered_for_internal_order_items(): void {
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 10]);
        $ioItem = $this->plainInternalOrderItem(10, 5);

        $this->assertArrayNotHasKey('items.0.quantity', $this->validate([$this->row(InternalOrderItem::class, $ioItem->id, 6)])->errors()->toArray());
        $this->assertArrayHasKey('items.0.quantity', $this->validate([$this->row(InternalOrderItem::class, $ioItem->id, 7)])->errors()->toArray());
    }

    #[Test]
    public function request_sums_rows_of_the_same_internal_order_item_and_reports_the_row_index(): void {
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 0]);
        $first  = $this->plainInternalOrderItem(10);
        $second = $this->plainInternalOrderItem(10);

        $validator = $this->validate([
            $this->row(InternalOrderItem::class, $second->id, 1),
            $this->row(InternalOrderItem::class, $first->id, 6),
            $this->row(InternalOrderItem::class, $first->id, 5),
        ]);

        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('items.1.quantity', $errors);
        $this->assertArrayNotHasKey('items.0.quantity', $errors);
    }

    #[Test]
    public function request_still_applies_the_tolerance_to_sales_order_rows(): void {
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 10]);
        $soItem = $this->makeSalesOrderItem(10);

        $this->assertArrayNotHasKey('items.0.quantity', $this->validate([$this->row(SalesOrderItem::class, $soItem->id, 11)])->errors()->toArray());
        $this->assertArrayHasKey('items.0.quantity', $this->validate([$this->row(SalesOrderItem::class, $soItem->id, 12)])->errors()->toArray());
    }

    #[Test]
    public function request_tolerance_covers_service_and_part_internal_order_lines_next_to_the_hard_consumed_limit(): void {
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 0]);
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $consumed     = AssetServiceConsumedItem::factory()->create(['asset_service_id' => $assetService->id, 'quantity' => 10]);
        $partItem     = InternalOrderItem::create([
            'internal_order_id'  => $this->makeInternalOrder()->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => 5,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumed->id,
        ]);
        $serviceItem = InternalOrderItem::create([
            'internal_order_id'  => $this->makeInternalOrder()->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'referenceable_type' => AssetService::class,
            'referenceable_id'   => $assetService->id,
        ]);

        // Batas keras consumed item (10) belum terlampaui, toleransi 0 pada qty IO (5) sudah.
        $part = $this->validate([$this->row(InternalOrderItem::class, $partItem->id, 6)]);
        $this->assertArrayHasKey('items.0.quantity', $part->errors()->toArray());
        $this->assertFalse($this->validate([$this->row(InternalOrderItem::class, $partItem->id, 5)])->errors()->has('items.0.quantity'));

        $service = $this->validate([$this->row(InternalOrderItem::class, $serviceItem->id, 2)]);
        $this->assertArrayHasKey('items.0.quantity', $service->errors()->toArray());
    }

    #[Test]
    public function request_exempts_returns_and_null_tolerance(): void {
        $ioItem = $this->plainInternalOrderItem(10);
        $soItem = $this->makeSalesOrderItem(10);

        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 0]);
        $return = $this->validate(
            [$this->row(InternalOrderItem::class, $ioItem->id, 50), $this->row(SalesOrderItem::class, $soItem->id, 50)],
            ['return_against' => ['id' => (string) Str::ulid()]],
        );
        $this->assertArrayNotHasKey('items.0.quantity', $return->errors()->toArray());
        $this->assertArrayNotHasKey('items.1.quantity', $return->errors()->toArray());

        SalesSetting::current()->update(['over_delivery_tolerance_percent' => null]);
        $neutral = $this->validate([$this->row(InternalOrderItem::class, $ioItem->id, 50), $this->row(SalesOrderItem::class, $soItem->id, 50)]);
        $this->assertArrayNotHasKey('items.0.quantity', $neutral->errors()->toArray());
        $this->assertArrayNotHasKey('items.1.quantity', $neutral->errors()->toArray());
    }

    // --- approve --------------------------------------------------------------------

    private function makeDeliveryNote(InternalOrderItem $ioItem, ItemVariant $itemVariant, float $quantity): DeliveryNote {
        DeliveryNote::initPermissions();

        $deliveryNote = DeliveryNote::create([
            'code'            => fake()->unique()->bothify('DN-####'),
            'delivery_date'   => now(),
            'reference_to_id' => Permission::create([
                'module' => 'inventory',
                'name'   => 'dn_io_' . fake()->unique()->numerify('####'),
                'model'  => DeliveryNote::class,
            ])->id,
            'referenceable_type' => InternalOrder::class,
            'referenceable_id'   => $ioItem->internal_order_id,
            'created_by_id'      => $ioItem->internalOrder->created_by_id,
        ]);

        DeliveryNoteItem::create([
            'delivery_note_id'    => $deliveryNote->id,
            'item_id'             => $itemVariant->id,
            'referenceable_type'  => InternalOrderItem::class,
            'referenceable_id'    => $ioItem->id,
            'source_warehouse_id' => $itemVariant->source_warehouse_id,
            'quantity'            => $quantity,
            'valuation_rates'     => [],
        ]);

        return $deliveryNote;
    }

    #[Test]
    public function approval_rejects_internal_order_quantity_over_the_tolerance_under_lock(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 0]);
        $variant = $this->makeItemVariantWithStock(20);
        $ioItem  = $this->plainInternalOrderItem(5, 0, $variant);
        $dn      = $this->makeDeliveryNote($ioItem, $variant, 6);

        try {
            (new DeliveryNoteService)->onApproved($dn->fresh());
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items', $exception->errors());
        }

        $this->assertSame(0.0, $ioItem->fresh()->delivered_quantity);
        $this->assertEqualsWithDelta(20.0, Stock::where('item_variant_id', $variant->id)->first()->quantity, 0.0001);
    }

    #[Test]
    public function approval_allows_internal_order_quantity_within_the_tolerance(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 20]);
        $variant = $this->makeItemVariantWithStock(20);
        $ioItem  = $this->plainInternalOrderItem(5, 0, $variant);
        $dn      = $this->makeDeliveryNote($ioItem, $variant, 6);

        (new DeliveryNoteService)->onApproved($dn->fresh());

        $this->assertEqualsWithDelta(6.0, $ioItem->fresh()->delivered_quantity, 0.0001);
    }

    #[Test]
    public function approval_with_null_tolerance_does_not_limit_internal_order_quantity(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => null]);
        $variant = $this->makeItemVariantWithStock(20);
        $ioItem  = $this->plainInternalOrderItem(5, 0, $variant);
        $dn      = $this->makeDeliveryNote($ioItem, $variant, 9);

        (new DeliveryNoteService)->onApproved($dn->fresh());

        $this->assertEqualsWithDelta(9.0, $ioItem->fresh()->delivered_quantity, 0.0001);
    }

    #[Test]
    public function approval_applies_the_tolerance_to_service_lines_of_an_internal_order(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);
        SalesSetting::current()->update(['over_delivery_tolerance_percent' => 0]);
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $variant      = $this->makeItemVariantWithStock(20);
        $ioItem       = InternalOrderItem::create([
            'internal_order_id'  => $this->makeInternalOrder()->id,
            'item_id'            => $variant->id,
            'quantity'           => 1,
            'referenceable_type' => AssetService::class,
            'referenceable_id'   => $assetService->id,
        ]);
        $dn = $this->makeDeliveryNote($ioItem, $variant, 2);

        $this->expectException(ValidationException::class);
        (new DeliveryNoteService)->onApproved($dn->fresh());
    }
}
