<?php

namespace App\Enums;

enum AssetMovementPurpose: string {
    case ISSUE              = 'issue';
    case RECEIPT            = 'receipt';
    case TRANSFER           = 'transfer';
    case TRANSFER_AND_ISSUE = 'transfer_and_issue';
    case RENT_OUT           = 'rent_out';
    case RETURN_FROM_RENT   = 'return_from_rent';
    case SELL               = 'sell';

    public function label() {
        return __("asset.movement.purpose.{$this->value}");
    }
}
