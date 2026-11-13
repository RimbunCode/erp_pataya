<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Purchase Invoice (design.md, peta rule): dua jurnal.
 *
 * - `stock` (hanya bila `stock_total` > 0 dan bukan retur): debit `stock`, kredit `stock_received_but_not_billed`
 *   sebesar `stock_total`.
 * - `expense` (bila `total` bukan nol): debit `expense` (per baris, peka-barang), kredit `payable` sebesar `total`;
 *   retur menukar sisi. Peran `expense` dipetakan ke SRNB demi parity (T-9, Q-P2-8).
 *
 * Kontrak konteks: `amounts['total']`, `amounts['stock_total']`, `flags['is_return']`, `lines[]` opsional dengan
 * `amounts['amount']` yang berjumlah `total`.
 */
final class PurchaseInvoiceRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseInvoice;
    }

    public function build(PostingContext $ctx): array {
        $drafts = [];

        $stockTotal = $ctx->amount('stock_total');
        if ($stockTotal > 0 && ! $ctx->isReturn()) {
            $drafts[] = self::pair('stock', AccountRole::Stock, AccountRole::StockReceivedButNotBilled, $stockTotal);
        }

        $drafts[] = $this->expenseDraft($ctx);

        return self::compact($drafts);
    }

    private function expenseDraft(PostingContext $ctx): ?RoleJournalDraft {
        $total = $ctx->amount('total');
        if (self::isZero($total)) {
            return null;
        }

        $return  = $ctx->isReturn();
        $expense = [];
        foreach ($ctx->lines as $line) {
            if (! self::isZero($line->amount('amount'))) {
                $expense[] = $return
                    ? RoleLine::credit(AccountRole::Expense, $line->amount('amount'), line: $line)
                    : RoleLine::debit(AccountRole::Expense, $line->amount('amount'), line: $line);
            }
        }
        if ($expense === []) {
            $expense = [$return ? RoleLine::credit(AccountRole::Expense, $total) : RoleLine::debit(AccountRole::Expense, $total)];
        }

        $payable = $return ? RoleLine::debit(AccountRole::Payable, $total) : RoleLine::credit(AccountRole::Payable, $total);

        return new RoleJournalDraft('expense', [...$expense, $payable]);
    }
}
