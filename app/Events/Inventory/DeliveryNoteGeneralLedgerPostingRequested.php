<?php

namespace App\Events\Inventory;

use App\Models\Inventory\DeliveryNote;
use Illuminate\Foundation\Events\Dispatchable;

class DeliveryNoteGeneralLedgerPostingRequested {
    use Dispatchable;

    public function __construct(
        public readonly DeliveryNote $deliveryNote,
        public readonly float $totalPicked,
        public readonly bool $isReturn,
        public readonly \DateTimeInterface $transactionDate,
    ) {}
}
