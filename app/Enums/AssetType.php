<?php

namespace App\Enums;

enum AssetType: string {
    case EXISTING_ASSET      = 'existing_asset';
    case COMPOSITE_ASSET     = 'composite_asset';
    case COMPOSITE_COMPONENT = 'composite_component';

    public function label() {
        return __("asset.type.{$this->value}");
    }
}
