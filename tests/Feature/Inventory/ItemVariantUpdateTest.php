<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Attribute;
use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Services\Inventory\ItemServices;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItemVariantUpdateTest extends TestCase {
    use RefreshDatabase;

    public function test_update_variants_does_not_crash_when_variant_already_exists(): void {
        $unit = Unit::create([
            'code'              => 'UNIT-1',
            'name'              => 'Unit 1',
            'group'             => 'Quantity',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $category = Category::create([
            'name' => 'Category 1',
            'type' => 'inventory',
        ]);

        $attribute = Attribute::create([
            'name'       => 'Color',
            'is_numeric' => false,
            'values'     => [
                ['value' => 'Red'],
                ['value' => 'Blue'],
            ],
        ]);

        $item = Item::create([
            'code'              => 'ITEM-VARIANT-1',
            'name'              => 'Item Variant 1',
            'category_id'       => $category->id,
            'default_unit_id'   => $unit->id,
            'conversion_factor' => 1,
            'type'              => 'inventory',
            'format_variant'    => '@[Color](' . $attribute->id . ')',
        ]);

        $attributesPayload = [
            [
                'attribute' => [
                    'id'   => $attribute->id,
                    'name' => $attribute->name,
                ],
                'values' => ['Red', 'Blue'],
            ],
        ];

        $service = new ItemServices;

        // First call creates the variants.
        $service->updateVariants($item, $item->format_variant, $attributesPayload);

        $this->assertSame(2, $item->variants()->count());

        // Second call with the same attributes hits the "variant already exists" update branch.
        $service->updateVariants($item, $item->format_variant, $attributesPayload);

        $this->assertSame(2, $item->variants()->count());
    }
}
