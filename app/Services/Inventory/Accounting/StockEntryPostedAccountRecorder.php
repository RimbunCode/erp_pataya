<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Stock Entry (Requirement 13.2, Task 12.1), senyap lewat query builder
 * (tanpa event model dan audit log):
 *
 * - `stock_entries.difference_account_id` <- akun `stock_adjustment` bila semua barisnya satu akun, null bila beragam
 *   (keputusan pemilik produk, 25 Nov 2026);
 * - `stock_entry_items.posted_account_id` <- akun `stock_adjustment` per baris;
 * - `additional_costs.expense_account_id` <- akun `expense_included_in_valuation` biaya itu (purpose
 *   `additional_cost:{id}`); tabel polimorfik, jadi dibatasi ke biaya milik Stock Entry ini.
 */
final class StockEntryPostedAccountRecorder implements PostedAccountRecorder {
    private const COST_PURPOSE_PREFIX = 'additional_cost:';

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::StockEntry;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        $adjustment = AccountRole::StockAdjustment->value;

        if ($notes->forRole($adjustment) !== []) {
            DB::table('stock_entries')->where('id', $ctx->sourceId)->update([
                'difference_account_id' => $notes->uniformAccountFor($adjustment),
            ]);
        }

        foreach ($notes->byLine($adjustment) as $lineId => $accountId) {
            DB::table('stock_entry_items')
                ->where('id', $lineId)
                ->where('stock_entry_id', $ctx->sourceId)
                ->update(['posted_account_id' => $accountId]);
        }

        foreach ($notes->forRole(AccountRole::ExpenseIncludedInValuation->value) as $note) {
            if (! str_starts_with($note->purpose, self::COST_PURPOSE_PREFIX)) {
                continue;
            }

            DB::table('additional_costs')
                ->where('id', substr($note->purpose, \strlen(self::COST_PURPOSE_PREFIX)))
                ->where('referenceable_type', $ctx->sourceType)
                ->where('referenceable_id', $ctx->sourceId)
                ->update(['expense_account_id' => $note->accountId]);
        }
    }
}
