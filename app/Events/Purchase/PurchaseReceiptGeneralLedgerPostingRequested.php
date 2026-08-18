<?php

namespace App\Events\Purchase;

use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseReceiptGeneralLedgerPostingRequested {
    use Dispatchable;

    public function __construct(
        public readonly PurchaseReceipt $purchaseReceipt,
        public readonly float $totalRatesForGL,
        public readonly bool $isReturn,
        public readonly \DateTimeInterface $transactionDate,
    ) {}
}
