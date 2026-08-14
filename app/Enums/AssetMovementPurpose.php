<?php

namespace App\Enums;

enum AssetMovementPurpose: string {
    case ISSUE              = 'issue';
    case RECEIPT            = 'receipt';
    case TRANSFER           = 'transfer';
    case TRANSFER_AND_ISSUE = 'transfer_and_issue';

    public function label() {
        return __("asset.movement.purpose.{$this->value}");
    }
}
