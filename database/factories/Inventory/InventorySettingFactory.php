<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\InventorySetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventorySetting>
 */
class InventorySettingFactory extends Factory {
    protected $model = InventorySetting::class;

    public function definition(): array {
        return [
            'singleton'            => true,
            'default_warehouse_id' => null,
        ];
    }
}
