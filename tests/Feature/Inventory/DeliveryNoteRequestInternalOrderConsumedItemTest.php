<?php

namespace Tests\Feature\Inventory;

use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\User\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Requirement 3.4, spec asset-service-internal-order: validasi
 * DeliveryNoteItem.quantity tidak melebihi AssetServiceConsumedItem.quantity
 * sebelumnya hanya berlaku utk baris referenceable_type=SalesOrderItem — baris
 * dari InternalOrderItem di-skip tanpa validasi apapun. Sekarang disamakan.
 */
class DeliveryNoteRequestInternalOrderConsumedItemTest extends TestCase {
    use RefreshDatabase;

    private function makeInternalOrderItemForConsumedItem(float $consumedQuantity): InternalOrderItem {
        $assetService = AssetService::factory()->create();
        $consumedItem = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'quantity'         => $consumedQuantity,
        ]);

        InternalOrder::initPermissions();
        $internalOrder = InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);

        return InternalOrderItem::create([
            'internal_order_id'  => $internalOrder->id,
            'item_id'            => ItemVariant::factory()->create()->id,
            'quantity'           => $consumedQuantity,
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
    public function rejects_quantity_exceeding_consumed_item_from_internal_order(): void {
        $ioItem = $this->makeInternalOrderItemForConsumedItem(5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => InternalOrderItem::class,
            'referenceable_id'   => $ioItem->id,
            'quantity'           => 10,
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.quantity', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_quantity_within_consumed_item_from_internal_order(): void {
        $ioItem = $this->makeInternalOrderItemForConsumedItem(5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => InternalOrderItem::class,
            'referenceable_id'   => $ioItem->id,
            'quantity'           => 5,
        ]);

        $this->assertFalse($validator->fails());
    }
}
