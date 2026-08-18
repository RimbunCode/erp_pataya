<?php

namespace App\Events\Finances;

use App\Models\Finances\PurchaseInvoice;
use Illuminate\Foundation\Events\Dispatchable;

class PurchaseInvoiceGeneralLedgerPostingRequested {
    use Dispatchable;

    public function __construct(
        public readonly PurchaseInvoice $purchaseInvoice,
        public readonly float $totalStockGL,
        public readonly float $totalAmount,
        public readonly bool $isReturn,
        public readonly \DateTimeInterface $transactionDate,
        public readonly string $expenseHeadAccountId,
        public readonly string $creditAccountId,
    ) {}
}
