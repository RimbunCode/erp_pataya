<?php

namespace Database\Factories\Asset;

use App\Models\Asset\AssetCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetCategory>
 */
class AssetCategoryFactory extends Factory {
    protected $model = AssetCategory::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $categoryName = fake()->randomElement([
            'Computer Equipment',
            'Office Furniture',
            'Vehicles',
            'Machinery',
            'Buildings',
            'Tools & Equipment',
        ]);

        return [
            'category_name'            => $categoryName . ' ' . fake()->unique()->numerify('##'),
            'non_depreciable_category' => false,
            'enable_cwip_accounting'   => false,
            'is_rentable'              => false,
        ];
    }

    public function nonDepreciable(): static {
        return $this->state(fn (array $attributes) => [
            'non_depreciable_category' => true,
        ]);
    }

    public function rentable(): static {
        return $this->state(fn (array $attributes) => [
            'is_rentable' => true,
        ]);
    }

    public function cwip(): static {
        return $this->state(fn (array $attributes) => [
            'enable_cwip_accounting' => true,
        ]);
    }
}
