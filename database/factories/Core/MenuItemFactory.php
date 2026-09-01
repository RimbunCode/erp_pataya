<?php

namespace Database\Factories\Core;

use App\Models\Core\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuItem>
 */
class MenuItemFactory extends Factory {
    protected $model = MenuItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'label'           => fake()->unique()->words(2, true),
            'icon'            => 'PackageIcon',
            'route_name'      => 'dashboard',
            'model'           => null,
            'order'           => 0,
            'primary_desk_id' => DeskFactory::new(),
        ];
    }
}
