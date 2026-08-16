<?php

namespace Database\Factories\Inventory;

use App\Models\Asset\Asset;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\DeliveryNoteItemAsset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryNoteItemAsset>
 */
class DeliveryNoteItemAssetFactory extends Factory {
    protected $model = DeliveryNoteItemAsset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'delivery_note_item_id' => DeliveryNoteItem::factory(),
            'asset_id'              => Asset::factory(),
            'quantity'              => 1,
        ];
    }
}
