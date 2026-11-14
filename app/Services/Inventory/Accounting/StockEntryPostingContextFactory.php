<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\AdditionalCost;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockEntryItem;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Pabrik `PostingContext` Stock Entry (Finance Fase 2, Task 8.3). Milik domain Inventory (P-8).
 *
 * - `basic_total` = Σ `basic_amount` baris (nilai yang sama dengan jurnal lama); `lines[].amount` = `basic_amount` baris,
 *   sehingga `stock_adjustment` peka-barang dievaluasi per baris dan berjumlah `basic_total`.
 * - `additional_costs` = `{id, amount}` tiap biaya tambahan (semua jenis entri, T-6): satu jurnal `additional_cost:{id}`
 *   per biaya. Kolom akun dokumen (`difference_account_id`, `expense_account_id`) tidak dibaca (Requirement 7.4).
 * - Tanggal jurnal lama adalah `now()` (T-8), `branchId` null, `sourceType` FQCN.
 * - Mutasi `accounts.balance_amount` bukan urusan konteks maupun engine (Requirement 7.5): tetap di `StockEntryService`.
 */
final class StockEntryPostingContextFactory {
    /**
     * @param  Collection<int, StockEntryItem>  $items  baris dengan relasi `item` (varian) dimuat
     * @param  Collection<int, AdditionalCost>  $additionalCosts
     */
    public function forApproval(StockEntry $stockEntry, Collection $items, Collection $additionalCosts, float $totalBasicAmount, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::StockEntry,
            sourceType: $stockEntry->getMorphClass(),
            sourceId: (string) $stockEntry->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['basic_total' => $totalBasicAmount],
            flags: [
                'entry_type'       => $stockEntry->type,
                'additional_costs' => $additionalCosts
                    ->map(fn ($cost): array => ['id' => (string) $cost->getKey(), 'amount' => (float) $cost->amount])
                    ->values()
                    ->all(),
            ],
            lines: $items->map(function ($item): LineAttributes {
                $variant = $item->item;

                return new LineAttributes(
                    amounts: ['amount' => (float) $item->basic_amount],
                    itemType: $variant?->type !== null ? (string) $variant->type : null,
                    isStockItem: $variant?->is_stock_item !== null ? (bool) $variant->is_stock_item : null,
                    itemCategoryId: $variant?->category_id !== null ? (string) $variant->category_id : null,
                    lineId: (string) $item->getKey(),
                );
            })->values()->all(),
        );
    }
}
