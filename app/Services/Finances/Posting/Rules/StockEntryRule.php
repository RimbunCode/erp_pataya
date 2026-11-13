<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Stock Entry (design.md, peta rule; T-5, T-6).
 *
 * - `item_receipt`: jurnal `default`, debit `stock`, kredit `stock_adjustment` sebesar `amounts['basic_total']`.
 * - `item_issue`: sisi sebaliknya (debit `stock_adjustment`, kredit `stock`).
 * - `item_transfer`, `item_consumption`: tidak ada jurnal utama (perilaku sekarang, T-5).
 * - Tiap biaya tambahan (`flags['additional_costs']`: list `{id, amount}`; semua jenis, T-6): jurnal
 *   `additional_cost:{id}`, debit `stock`, kredit `expense_included_in_valuation`.
 *
 * Kontrak konteks: `flags['entry_type']`; `lines[]` opsional dengan `amounts['amount']` (basic_amount per baris) yang
 * berjumlah `basic_total`, dipakai untuk `stock_adjustment` per baris (peka-barang); sisi `stock` tetap tingkat
 * dokumen. Tanggal jurnal lama adalah `now()` (T-8): pabrik konteks meneruskannya sebagai `transactionDate`.
 */
final class StockEntryRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::StockEntry;
    }

    public function build(PostingContext $ctx): array {
        $drafts = [$this->mainDraft($ctx)];

        foreach ((array) $ctx->flag('additional_costs', []) as $cost) {
            $drafts[] = self::pair(
                'additional_cost:' . $cost['id'],
                AccountRole::Stock,
                AccountRole::ExpenseIncludedInValuation,
                (float) $cost['amount'],
            );
        }

        return self::compact($drafts);
    }

    private function mainDraft(PostingContext $ctx): ?RoleJournalDraft {
        $type = $ctx->flag('entry_type');
        if (! \in_array($type, ['item_receipt', 'item_issue'], true)) {
            return null;
        }

        $total = $ctx->amount('basic_total');
        if (self::isZero($total)) {
            return null;
        }

        $adjustment = [];
        foreach ($ctx->lines as $line) {
            if (! self::isZero($line->amount('amount'))) {
                $adjustment[] = [$line->amount('amount'), $line];
            }
        }
        if ($adjustment === []) {
            $adjustment = [[$total, null]];
        }

        $receipt = $type === 'item_receipt';
        $lines   = [$receipt ? RoleLine::debit(AccountRole::Stock, $total) : RoleLine::credit(AccountRole::Stock, $total)];
        foreach ($adjustment as [$amount, $line]) {
            $lines[] = $receipt
                ? RoleLine::credit(AccountRole::StockAdjustment, $amount, line: $line)
                : RoleLine::debit(AccountRole::StockAdjustment, $amount, line: $line);
        }

        return new RoleJournalDraft('default', $lines);
    }
}
