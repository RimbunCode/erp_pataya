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
        $item = Item::query()->inRandomOrder()->first() ?? ItemFactory::new()->create();

        return [
            'code'                   => fake()->unique()->bothify('VAR-####'),
            'item_id'                => $item->id,
            'category_id'            => $item->category_id,
            'default_unit_id'        => $item->default_unit_id,
            'item_code'              => $item->code,
            'item_name'              => $item->name,
            'format_variant'         => fake()->optional()->word(),
            'description'            => fake()->optional()->sentence(),
            'is_disabled'            => false,
            'allow_alternative_item' => fake()->boolean(30),
            'conversion_factor'      => 1,
            'is_stock_item'          => $item->is_stock_item,
            'type'                   => $item->type,
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
