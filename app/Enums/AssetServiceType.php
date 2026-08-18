<?php

namespace App\Enums;

enum AssetServiceType: string {
    case MAINTENANCE_TASK = 'maintenance_task';
    case REPAIR           = 'repair';

    public function label() {
        return __("asset/service.type.{$this->value}");
    }
}
