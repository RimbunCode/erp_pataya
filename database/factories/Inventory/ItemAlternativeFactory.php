<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\ItemAlternative;
use App\Models\Inventory\ItemVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItemAlternative>
 */
class ItemAlternativeFactory extends Factory {
    protected $model = ItemAlternative::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $itemVariants = ItemVariant::query()->inRandomOrder()->limit(2)->get();
        if ($itemVariants->count() < 2) {
            $missing = 2 - $itemVariants->count();
            $generated = ItemVariantFactory::new()->count($missing)->create();
            $itemVariants = $itemVariants->concat($generated);
        }

        $item = $itemVariants->first();
        $alternative = $itemVariants->last();

        if ($item->id === $alternative->id) {
            $alternative = ItemVariantFactory::new()->create();
        }

        return [
            'item_id'             => $item->id,
            'alternative_item_id' => $alternative->id,
            'two_way'             => fake()->boolean(50),
        ];
    }
}
