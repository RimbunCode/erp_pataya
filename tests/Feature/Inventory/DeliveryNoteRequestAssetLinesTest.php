<?php

namespace Tests\Feature\Inventory;

use App\Http\Requests\Inventory\DeliveryNoteRequest;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Inventory\Item;
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

/**
 * Requirement 1.2, 1.3, spec asset-rental-migration: validasi asset_lines
 * (sum quantity, is_rentable, item match) harus terjadi saat submit
 * DeliveryNote, bukan baru saat approve.
 */
class DeliveryNoteRequestAssetLinesTest extends TestCase {
    use RefreshDatabase;

    private function makeSalesOrderItem(ItemVariant $item, float $quantity): SalesOrderItem {
        SalesOrder::initPermissions();
        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
        ]);

        return SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $item->id,
            'quantity'       => $quantity,
            'price'          => 0,
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
    public function accepts_asset_lines_matching_quantity_rentable_and_item(): void {
        $item     = ItemVariant::factory()->create();
        $category = AssetCategory::factory()->create();
        $asset    = Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->item_id]);
        $soItem   = $this->makeSalesOrderItem($item, 5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'asset_lines'        => [
                ['asset' => ['id' => $asset->id], 'quantity' => 5],
            ],
        ]);

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    #[Test]
    public function rejects_asset_lines_quantity_sum_mismatch(): void {
        $item     = ItemVariant::factory()->create();
        $category = AssetCategory::factory()->create();
        $asset    = Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $item->item_id]);
        $soItem   = $this->makeSalesOrderItem($item, 5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'asset_lines'        => [
                ['asset' => ['id' => $asset->id], 'quantity' => 2],
            ],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_asset_that_is_not_rentable(): void {
        $item     = ItemVariant::factory()->create();
        $category = AssetCategory::factory()->create();
        $asset    = Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $item->item_id, 'is_rentable' => false]);
        $soItem   = $this->makeSalesOrderItem($item, 5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'asset_lines'        => [
                ['asset' => ['id' => $asset->id], 'quantity' => 5],
            ],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines.0.asset', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_asset_belonging_to_different_item(): void {
        $item      = ItemVariant::factory()->create(['item_id' => Item::factory()->create()->id]);
        $otherItem = ItemVariant::factory()->create(['item_id' => Item::factory()->create()->id]);
        $category  = AssetCategory::factory()->create();
        $asset     = Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $otherItem->item_id]);
        $soItem    = $this->makeSalesOrderItem($item, 5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'asset_lines'        => [
                ['asset' => ['id' => $asset->id], 'quantity' => 5],
            ],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines.0.asset', $validator->errors()->toArray());
    }

    #[Test]
    public function rejects_asset_lines_referencing_nonexistent_asset(): void {
        $item   = ItemVariant::factory()->create();
        $soItem = $this->makeSalesOrderItem($item, 5);

        $validator = $this->validate([
            'id'                 => (string) Str::ulid(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 5,
            'asset_lines'        => [
                ['asset' => ['id' => (string) Str::ulid()], 'quantity' => 5],
            ],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.asset_lines.0.asset', $validator->errors()->toArray());
    }
}
