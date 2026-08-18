<?php

namespace App\Events\Finances;

use App\Models\Finances\SalesInvoice;
use Illuminate\Foundation\Events\Dispatchable;

class SalesInvoiceGeneralLedgerPostingRequested {
    use Dispatchable;

    public function __construct(
        public readonly SalesInvoice $salesInvoice,
        public readonly float $totalAmount,
        public readonly bool $isReturn,
        public readonly \DateTimeInterface $transactionDate,
        public readonly string $debitAccountId,
        public readonly string $creditAccountId,
    ) {}
}
