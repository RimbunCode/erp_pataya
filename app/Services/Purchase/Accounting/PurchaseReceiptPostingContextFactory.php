<?php

namespace App\Services\Purchase\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Purchase Receipt (Finance Fase 2, Task 8.1). Milik domain Purchase (P-8). Nilai (`total` =
 * nilai rate untuk GL), arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama.
 * `lines` berisi satu baris per baris receipt yang bernilai (dari `lineAmounts` event), supaya `stock` peka-barang dan
 * akunnya dicatat per baris (Task 12.1); `lineAmounts` kosong memberi konteks tingkat dokumen seperti semula.
 * Peran `stock`/`stock_received_but_not_billed` bukan akun master: di-resolve dari profil.
 */
final class PurchaseReceiptPostingContextFactory {
    /**
     * @param  array<string, float>  $lineAmounts  nilai GL per baris receipt (id baris => nilai)
     */
    public function forPosting(PurchaseReceipt $purchaseReceipt, float $totalRatesForGl, bool $isReturn, CarbonInterface $transactionDate, array $lineAmounts = []): PostingContext {
        $lines = [];
        if ($lineAmounts !== []) {
            $items = $purchaseReceipt->items()->with('item')->whereIn('id', array_keys($lineAmounts))->get();
            foreach ($items as $item) {
                $amount = (float) ($lineAmounts[$item->getKey()] ?? 0);
                if (abs($amount) < 1e-9) {
                    continue;
                }
                $variant = $item->item;
                $lines[] = new LineAttributes(
                    amounts: ['amount' => $amount],
                    itemType: $variant?->type !== null ? (string) $variant->type : null,
                    isStockItem: $variant?->is_stock_item !== null ? (bool) $variant->is_stock_item : null,
                    itemCategoryId: $variant?->category_id !== null ? (string) $variant->category_id : null,
                    lineId: (string) $item->getKey(),
                );
            }
        }

        return new PostingContext(
            documentType: PostingDocumentType::PurchaseReceipt,
            sourceType: $purchaseReceipt->getMorphClass(),
            sourceId: (string) $purchaseReceipt->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalRatesForGl],
            flags: ['is_return' => $isReturn],
            lines: $lines,
        );
    }
}
