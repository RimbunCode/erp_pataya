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
 *
 * Posting diskon terpisah (Requirement 14.3), hanya jurnal `expense`: bila `flags['discount_split']` dan
 * `amounts['discount_amount']` (Σ diskon baris non-stok) > 0 dan ada `lines[]`, baris yang tegas non-stok
 * (`isStockItem === false`) didebit `expense` sebesar `gross_amount` (kotor), baris stok dan baris tanpa atribut stok
 * tetap `amount` (bersih), satu baris `discount` DIKREDIT sebesar `discount_amount` (potongan pembelian), dan `payable`
 * tetap `total`; retur menukar semua sisi. Jurnal `stock` tidak berubah. Tanpa flag atau diskon nol, bentuk jurnal
 * identik dengan sebelumnya.
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

        $return   = $ctx->isReturn();
        $discount = $ctx->amount('discount_amount');
        $split    = (bool) $ctx->flag('discount_split', false) && $ctx->lines !== [] && ! self::isZero($discount);

        $expense = [];
        foreach ($ctx->lines as $line) {
            $amount = $split && $line->isStockItem === false ? $line->amount('gross_amount') : $line->amount('amount');
            if (! self::isZero($amount)) {
                $expense[] = $return
                    ? RoleLine::credit(AccountRole::Expense, $amount, line: $line)
                    : RoleLine::debit(AccountRole::Expense, $amount, line: $line);
            }
        }
        if ($expense === []) {
            $split   = false;
            $expense = [$return ? RoleLine::credit(AccountRole::Expense, $total) : RoleLine::debit(AccountRole::Expense, $total)];
        }

        $payable = $return ? RoleLine::debit(AccountRole::Payable, $total) : RoleLine::credit(AccountRole::Payable, $total);

        $discountLines = [];
        if ($split) {
            $discountLines[] = $return ? RoleLine::debit(AccountRole::Discount, $discount) : RoleLine::credit(AccountRole::Discount, $discount);
        }

        return new RoleJournalDraft('expense', [...$expense, ...$discountLines, $payable]);
    }
}
