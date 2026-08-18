<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DeliveryNoteRequestAssetServiceConsumedItemTest extends TestCase {
    use RefreshDatabase;

    private function makeSalesOrderItemForConsumedItem(float $consumedQuantity): SalesOrderItem {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);
        $consumedItem = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'quantity'         => $consumedQuantity,
        ]);

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
            'quantity'           => $consumedQuantity,
            'price'              => 0,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);
    }

    private function validate(array $item): Validator {
        $data = ['items' => [$item]];

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

    #[Test]
    public function rejects_quantity_exceeding_consumed_item(): void {
        $soItem = $this->makeSalesOrderItemForConsumedItem(5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 10,
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.quantity', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_quantity_within_consumed_item(): void {
        $soItem = $this->makeSalesOrderItemForConsumedItem(5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
        ]);

        $this->assertFalse($validator->fails());
    }
}
