<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemBarcode;
use App\Models\Inventory\ItemVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItemVariant>
 */
class ItemVariantFactory extends Factory {
    protected $model = ItemVariant::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $item         = Item::query()->inRandomOrder()->first() ?? ItemFactory::new()->create();
        $variantLabel = $item->type === 'goods'
            ? fake()->randomElement([
                'Small',
                'Medium',
                'Large',
                'Blue',
                'Red',
                'Heavy Duty',
            ])
            : fake()->randomElement([
                'Basic Package',
                'Standard Package',
                'Premium Package',
                'Emergency Call',
            ]);

        return [
            'code'                   => $item->code . '-' . fake()->unique()->bothify('V##'),
            'item_id'                => $item->id,
            'category_id'            => $item->category_id,
            'default_unit_id'        => $item->default_unit_id,
            'item_code'              => $item->code,
            'item_name'              => $item->name . ' ' . $variantLabel,
            'format_variant'         => $variantLabel,
            'description'            => "Variant {$variantLabel} for {$item->name}.",
            'is_disabled'            => false,
            'allow_alternative_item' => (bool) $item->allow_alternative_item,
            'conversion_factor'      => $item->type === 'goods'
                ? fake()->randomFloat(2, 0.5, 5)
                : 1,
            'is_stock_item' => $item->is_stock_item,
            'type'          => $item->type,
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (ItemVariant $itemVariant): void {
            if (! $itemVariant->default_unit_id) {
                return;
            }

            ItemBarcode::query()->firstOrCreate([
                'item_variant_id' => $itemVariant->id,
                'unit_id'         => $itemVariant->default_unit_id,
            ], [
                'barcode' => fake()->unique()->ean13(),
            ]);
        });
    }
}
