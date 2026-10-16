<?php

namespace App\Services\Purchase\FromRequests;

use App\Enums\FormStatus;
use App\Models\Purchase\PurchaseRequest;

class PurchaseRequestPoEligibility {
    private const BLOCKED_STATUSES = [
        FormStatus::DRAFT,
        FormStatus::CANCELED,
        FormStatus::REJECTED,
        FormStatus::DELETED,
        FormStatus::CLOSED,
        FormStatus::NEED_APPROVAL,
        FormStatus::INACTIVE,
    ];

    public static function isEligible(PurchaseRequest $purchaseRequest): bool {
        if (! $purchaseRequest->submitted_at) {
            return false;
        }

        foreach ((array) $purchaseRequest->status as $status) {
            if (in_array($status, self::BLOCKED_STATUSES, true)) {
                return false;
            }
        }

        if ($purchaseRequest->relationLoaded('items')) {
            return $purchaseRequest->items->contains(
                fn ($item): bool => (float) $item->unordered_quantity > 0,
            );
        }

        return $purchaseRequest->items()->where('unordered_quantity', '>', 0)->exists();
    }
}
