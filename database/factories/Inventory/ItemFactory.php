<?php

namespace Database\Factories\Inventory;

use App\Models\Core\File;
use App\Models\Inventory\Category;
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
        $itemType     = fake()->randomElement(['goods', 'service']);
        $categoryType = $itemType === 'goods' ? 'inventory' : 'service';
        $category     = Category::query()
            ->where('type', $categoryType)
            ->inRandomOrder()
            ->first() ?? CategoryFactory::new()->state([
                'type' => $categoryType,
            ])->create();

        $baseName = $itemType === 'goods'
            ? fake()->randomElement([
                'Steel Pipe',
                'Safety Helmet',
                'Industrial Bolt',
                'Hydraulic Hose',
                'Packaging Box',
            ])
            : fake()->randomElement([
                'Installation Service',
                'On-site Maintenance',
                'Technical Inspection',
                'Calibration Service',
                'Delivery Service',
            ]);

        $defaultUnitId = $this->resolveDefaultUnitId();

        return [
            'code'        => fake()->unique()->bothify(($itemType === 'goods' ? 'GDS' : 'SRV') . '-####'),
            'name'        => $baseName . ' ' . fake()->unique()->numerify('###'),
            'description' => $itemType === 'goods'
                ? "Physical inventory item for {$category->name}."
                : "Service item for {$category->name}.",
            'category_id'       => $category->id,
            'default_unit_id'   => $defaultUnitId,
            'conversion_factor' => $itemType === 'goods'
                ? fake()->randomFloat(2, 1, 10)
                : 1,
            'stock_minimum' => $itemType === 'goods'
                ? fake()->numberBetween(5, 50)
                : 0,
            'image_id'               => File::query()->inRandomOrder()->value('id'),
            'is_disabled'            => false,
            'allow_alternative_item' => $itemType === 'goods' ? fake()->boolean(40) : false,
            'is_stock_item'          => $itemType === 'goods',
            'type'                   => $itemType,
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
