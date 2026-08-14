<?php

namespace Database\Factories\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetMovementItem>
 */
class AssetMovementItemFactory extends Factory {
    protected $model = AssetMovementItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'asset_movement_id' => AssetMovement::factory(),
            'asset_id'          => Asset::factory(),
        ];
    }
}
