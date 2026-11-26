<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Inventory\DeliveryNote;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Delivery Note (Finance Fase 2, Task 8.1 dan 12.1 bagian B). Milik domain Inventory (P-8).
 * Nilai (`total_picked`), arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama.
 *
 * `lines[]` diturunkan dari baris dokumen lewat `DeliveryNoteLineAmounts` (hanya baris bernilai bukan nol, `lineId` =
 * id baris, atribut barang dari relasi `item`) agar akun `cost_of_goods_sold` dan `stock` peka-barang dievaluasi per
 * baris. Relasi yang belum dimuat dimuat di sini.
 */
final class DeliveryNotePostingContextFactory {
    public function forPosting(DeliveryNote $deliveryNote, float $totalPicked, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        $deliveryNote->loadMissing('items.item', 'items.returnAgainstItem');

        $amounts = DeliveryNoteLineAmounts::forDocument($deliveryNote, $isReturn);
        $lines   = [];

        foreach ($deliveryNote->items as $item) {
            $amount = $amounts[(string) $item->getKey()] ?? null;
            if ($amount === null) {
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

        return new PostingContext(
            documentType: PostingDocumentType::DeliveryNote,
            sourceType: $deliveryNote->getMorphClass(),
            sourceId: (string) $deliveryNote->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total_picked' => $totalPicked],
            flags: ['is_return' => $isReturn],
            lines: $lines,
        );
    }
}
