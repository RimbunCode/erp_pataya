<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Inventory\DeliveryNote;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Delivery Note (Finance Fase 2, Task 8.1). Milik domain Inventory (P-8). Nilai (`total_picked`),
 * arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama.
 */
final class DeliveryNotePostingContextFactory {
    public function forPosting(DeliveryNote $deliveryNote, float $totalPicked, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::DeliveryNote,
            sourceType: $deliveryNote->getMorphClass(),
            sourceId: (string) $deliveryNote->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total_picked' => $totalPicked],
            flags: ['is_return' => $isReturn],
        );
    }
}
