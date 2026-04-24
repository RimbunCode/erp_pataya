<?php

namespace Database\Factories\Inventory;

use App\Models\Core\File;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory {
    protected $model = Item::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $defaultUnitId = $this->resolveDefaultUnitId();

        return [
            'code'                   => fake()->unique()->bothify('ITM-####'),
            'name'                   => fake()->unique()->words(3, true),
            'description'            => fake()->optional()->sentence(),
            'category_id'            => CategoryFactory::new()->create()->id,
            'default_unit_id'        => $defaultUnitId,
            'conversion_factor'      => fake()->randomFloat(2, 1, 20),
            'stock_minimum'          => fake()->numberBetween(0, 50),
            'image_id'               => File::query()->inRandomOrder()->value('id'),
            'is_disabled'            => false,
            'allow_alternative_item' => fake()->boolean(30),
            'is_stock_item'          => true,
            'type'                   => fake()->randomElement(['goods', 'service']),
            'format_variant'         => null,
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (Item $item): void {
            ItemUnit::query()->firstOrCreate([
                'item_id' => $item->id,
                'unit_id' => $item->default_unit_id,
            ], [
                'conversion_factor' => 1,
            ]);

            $relatedUnitId = Unit::query()
                ->where('id', '!=', $item->default_unit_id)
                ->where('group', Unit::query()->where('id', $item->default_unit_id)->value('group'))
                ->inRandomOrder()
                ->value('id');

            if ($relatedUnitId) {
                ItemUnit::query()->firstOrCreate([
                    'item_id' => $item->id,
                    'unit_id' => $relatedUnitId,
                ], [
                    'conversion_factor' => fake()->randomFloat(2, 0.1, 10),
                ]);
            }
        });
    }

    private function resolveDefaultUnitId(): string {
        $unitId = Unit::query()->where('is_default', true)->inRandomOrder()->value('id')
            ?? Unit::query()->inRandomOrder()->value('id');

        if ($unitId) {
            return $unitId;
        }

        return Unit::query()->create([
            'code'              => fake()->unique()->bothify('U##'),
            'name'              => fake()->word(),
            'group'             => 'Quantity',
            'conversion_factor' => 1,
            'is_default'        => true,
        ])->id;
    }
}
