<?php

namespace Tests\Feature\Sales;

use App\Enums\FormStatus;
use App\Http\Requests\Sales\SalesOrderRequest;
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

class SalesOrderRequestReferenceableTest extends TestCase {
    use RefreshDatabase;

    /**
     * Validasi HANYA field referenceable (bagian custom withValidator() spec
     * asset-service-billing), tidak ikut memvalidasi field lain di rules()
     * (unit/tax/source_warehouse dst — di luar scope task ini).
     */
    private function validateReferenceable(array $item): Validator {
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

    #[Test]
    public function rejects_referenceable_asset_service_not_approved(): void {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::DRAFT]]);

        $validator = $this->validateReferenceable([
            'id'            => (string) Str::ulid(),
            'referenceable' => ['type' => AssetService::class, 'id' => $assetService->id],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable.id', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_referenceable_asset_service_approved(): void {
        $assetService = AssetService::factory()->create(['status' => [FormStatus::APPROVED]]);

        $validator = $this->validateReferenceable([
            'id'            => (string) Str::ulid(),
            'referenceable' => ['type' => AssetService::class, 'id' => $assetService->id],
        ]);

        $this->assertFalse($validator->fails());
    }

    #[Test]
    public function rejects_referenceable_consumed_item_already_used(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $consumedItem->assetService->update(['status' => [FormStatus::APPROVED]]);

        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => 'SO-EXISTING',
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'B', 'is_disabled' => false])->id,
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

        $validator = $this->validateReferenceable([
            'id'            => (string) Str::ulid(),
            'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItem->id],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.referenceable.id', $validator->errors()->toArray());
    }

    #[Test]
    public function accepts_referenceable_consumed_item_not_yet_used(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $consumedItem->assetService->update(['status' => [FormStatus::APPROVED]]);

        $validator = $this->validateReferenceable([
            'id'            => (string) Str::ulid(),
            'referenceable' => ['type' => AssetServiceConsumedItem::class, 'id' => $consumedItem->id],
        ]);

        $this->assertFalse($validator->fails());
    }

    #[Test]
    public function null_referenceable_behaves_like_normal_item_row(): void {
        $validator = $this->validateReferenceable([
            'id' => (string) Str::ulid(),
        ]);

        $this->assertFalse($validator->fails());
    }
}
