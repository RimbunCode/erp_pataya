<?php

namespace App\Listeners\Asset\Movement;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetMovementApproved;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovementItem;

class UpdateAssetLocationFromMovement {
    public function handle(AssetMovementApproved $event): void {
        foreach ($event->movement->items as $item) {
            $this->applyToAsset($item->asset, $item, $event->movement->purpose);
        }
    }

    private function applyToAsset(Asset $asset, AssetMovementItem $item, AssetMovementPurpose $purpose): void {
        if ($item->target_location_id) {
            $asset->asset_location_id = $item->target_location_id;
        }
        if ($item->to_custodian_id) {
            $asset->custodian_id = $item->to_custodian_id;
        }

        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status ?? []);

        $statusValues = match ($purpose) {
            AssetMovementPurpose::ISSUE, AssetMovementPurpose::TRANSFER_AND_ISSUE => array_values(array_unique([...$statusValues, FormStatus::ISSUED->value])),
            AssetMovementPurpose::RECEIPT                                         => array_values(array_diff($statusValues, [FormStatus::ISSUED->value])),
            default                                                               => $statusValues,
        };

        $asset->status = array_map(fn (string $v) => FormStatus::from($v), $statusValues);
        $asset->save();
    }
}
