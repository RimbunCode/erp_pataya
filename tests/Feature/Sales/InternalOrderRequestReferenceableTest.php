<?php

namespace Tests\Feature\Sales;

use App\Enums\FormStatus;
use App\Http\Requests\Sales\InternalOrderRequest;
use App\Http\Requests\Sales\SalesOrderRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InternalOrderRequestReferenceableTest extends TestCase {
    use RefreshDatabase;

    private function makeItemUnit(): ItemUnit {
        $item = Item::factory()->create();
        $unit = Unit::create([
            'code'              => 'PCS-' . fake()->unique()->numerify('####'),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
    }

    private function validateInternalOrder(array $items): Validator {
        $data = ['date' => now()->toDateString(), 'items' => $items];

        $request = InternalOrderRequest::create('/', 'POST', $data);
        $request->setContainer(app());

        $validator = ValidatorFacade::make($data, $request->rules());
        $request->withValidator($validator);

        return $validator;
    }

    private function validateSalesOrder(array $item): Validator {
        $data = ['items' => [$item]];

        $validator = ValidatorFacade::make($data, [
            'items.*.referenceable.type' => ['nullable', 'string'],
            'items.*.referenceable.id'   => ['nullable', 'string'],
        ]);

        $request = SalesOrderRequest::create('/', 'POST', $data);
        $request->setContainer(app());
        $request->withValidator($validator);

        return $validator;
    }

    private function makeInternalOrderWithConsumedItemRow(AssetServiceConsumedItem $consumedItem): InternalOrderItem {
        InternalOrder::initPermissions();
        $internalOrder = InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);

        return InternalOrderItem::create([
            'internal_order_id'  => $internalOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => (float) $consumedItem->quantity,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);
    }

    #[Test]
    public function rejects_referenceable_asset_service_not_approved(): void {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::DRAFT]]);

        $validator = $this->validateInternalOrder([[
            'id'            => (string) Str::ulid(),
            'item'          => ['id' => ItemVariant::factory()->create()->id],
            'quantity'      => 1,
            'unit'          => ['id' => $this->makeItemUnit()->id],
            'referenceable' => ['type' => AssetService::class, 'id' => $assetService->id],
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable.id', $validator->errors()->toArray());
    }

    #[Test]
    public function consumed_item_used_by_sales_order_rejected_by_internal_order(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $consumedItem->assetService->update(['status' => [FormStatus::APPROVED]]);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'A', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);
        SalesOrderItem::create([
            'sales_order_id'     => $salesOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'price'              => 0,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        $validator = $this->validateInternalOrder([[
            'id'            => (string) Str::ulid(),
            'item'          => ['id' => ItemVariant::factory()->create()->id],
            'quantity'      => (float) $consumedItem->quantity,
            'unit'          => ['id' => $this->makeItemUnit()->id],
            'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItem->id],
        ]]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable.id', $validator->errors()->toArray());
    }

    #[Test]
    public function consumed_item_used_by_internal_order_rejected_by_sales_order(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $consumedItem->assetService->update(['status' => [FormStatus::APPROVED]]);

        $this->makeInternalOrderWithConsumedItemRow($consumedItem);

        $validator = $this->validateSalesOrder([
            'id'            => (string) Str::ulid(),
            'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItem->id],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable.id', $validator->errors()->toArray());
    }

    #[Test]
    public function distinct_item_rule_does_not_reject_two_different_consumed_items_with_same_item_variant(): void {
        $sharedItemVariant = ItemVariant::factory()->create();
        $consumedItemA     = AssetServiceConsumedItem::factory()->create();
        $consumedItemB     = AssetServiceConsumedItem::factory()->create();
        $consumedItemA->assetService->update(['status' => [FormStatus::APPROVED]]);
        $consumedItemB->assetService->update(['status' => [FormStatus::APPROVED]]);

        $unit = $this->makeItemUnit();

        $validator = $this->validateInternalOrder([
            [
                'id'            => (string) Str::ulid(),
                'item'          => ['id' => $sharedItemVariant->id],
                'quantity'      => (float) $consumedItemA->quantity,
                'unit'          => ['id' => $unit->id],
                'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItemA->id],
            ],
            [
                'id'            => (string) Str::ulid(),
                'item'          => ['id' => $sharedItemVariant->id],
                'quantity'      => (float) $consumedItemB->quantity,
                'unit'          => ['id' => $unit->id],
                'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItemB->id],
            ],
        ]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function distinct_rule_still_applies_to_non_referenceable_rows(): void {
        $sharedItemVariant = ItemVariant::factory()->create();
        $unit              = $this->makeItemUnit();

        $validator = $this->validateInternalOrder([
            [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => $sharedItemVariant->id],
                'quantity' => 1,
                'unit'     => ['id' => $unit->id],
            ],
            [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => $sharedItemVariant->id],
                'quantity' => 1,
                'unit'     => ['id' => $unit->id],
            ],
        ]);

        $this->assertTrue($validator->fails());
    }
}
