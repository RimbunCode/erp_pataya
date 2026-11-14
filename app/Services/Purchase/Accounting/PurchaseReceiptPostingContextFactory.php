<?php

namespace App\Services\Purchase\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Purchase Receipt (Finance Fase 2, Task 8.1). Milik domain Purchase (P-8). Nilai (`total` =
 * nilai rate untuk GL), arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama.
 * Peran `stock`/`stock_received_but_not_billed` bukan akun master: di-resolve dari profil.
 */
final class PurchaseReceiptPostingContextFactory {
    public function forPosting(PurchaseReceipt $purchaseReceipt, float $totalRatesForGl, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::PurchaseReceipt,
            sourceType: $purchaseReceipt->getMorphClass(),
            sourceId: (string) $purchaseReceipt->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalRatesForGl],
            flags: ['is_return' => $isReturn],
        );
    }
}
