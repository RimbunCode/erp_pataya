<?php

namespace App\Enums;

enum AssetOwnershipType: string {
    case COMPANY  = 'company';
    case SUPPLIER = 'supplier';
    case CUSTOMER = 'customer';

    public function label() {
        return __("asset.ownership_type.{$this->value}");
    }
}
