<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Verifikasi end-to-end filter `"item.is_fixed_asset": false` yang dikirim
 * ItemVariantLinkModel (dipakai InternalOrderItem/SalesOrderItem/
 * AssetServiceConsumedItem.item) beneran di-enforce backend lewat endpoint
 * asli POST /model — bukan cuma props React yang benar (sudah dicek RTL test).
 */
class ItemVariantFixedAssetLinkModelFilterTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function filter_item_is_fixed_asset_false_mengecualikan_variant_fixed_asset(): void {
        $user = User::factory()->create();

        $normalItem    = Item::factory()->create(['is_fixed_asset' => false]);
        $normalVariant = ItemVariant::factory()->create(['item_id' => $normalItem->id]);

        $fixedItem    = Item::factory()->create(['is_fixed_asset' => true]);
        $fixedVariant = ItemVariant::factory()->create(['item_id' => $fixedItem->id]);

        $response = $this
            ->actingAs($user)
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson('/model', [
                'model'   => ItemVariant::class,
                'filters' => ['item.is_fixed_asset' => false],
            ]);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($normalVariant->id));
        $this->assertFalse($ids->contains($fixedVariant->id));
    }
}
