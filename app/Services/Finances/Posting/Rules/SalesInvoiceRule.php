<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Sales Invoice (design.md, peta rule): satu jurnal `default`, debit `receivable` sebesar `total`, kredit `revenue`.
 * Retur menukar sisi. Kontrak konteks: `amounts['total']`; `flags['is_return']`; `lines[]` opsional dengan
 * `amounts['amount']` per baris (jumlah kredit `revenue` per baris, peka-barang) yang harus berjumlah `total`
 * (pabrik konteks menjaganya; selisih memicu `UnbalancedJournalException`). Tanpa `lines`, `revenue` satu baris
 * sebesar `total`, persis jalur Fase 1.
 *
 * Posting diskon terpisah (Requirement 14.2): bila `flags['discount_split']` dan `amounts['discount_amount']` > 0
 * dan ada `lines[]`, `revenue` dikredit sebesar `amounts['gross_amount']` per baris (kotor = bersih + diskon), satu baris
 * `discount` didebit sebesar `amounts['discount_amount']` (tingkat dokumen, bukan peka-barang), dan `receivable` tetap
 * `total` (bersih): Σdebit = total + diskon = Σ kotor = Σkredit (P-13). Pabrik konteks menjaga Σ `gross_amount` baris =
 * `total` + `discount_amount`. Tanpa flag, atau diskon nol, bentuk jurnal identik dengan sebelumnya. Dasar pajak/DPP
 * tidak disentuh (Requirement 14.5).
 */
final class SalesInvoiceRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::SalesInvoice;
    }

    public function build(PostingContext $ctx): array {
        $total = $ctx->amount('total');
        if (self::isZero($total)) {
            return [];
        }

        $discount = $ctx->amount('discount_amount');
        $split    = (bool) $ctx->flag('discount_split', false) && $ctx->lines !== [] && ! self::isZero($discount);

        $revenue = [];
        foreach ($ctx->lines as $line) {
            $amount = $split ? $line->amount('gross_amount') : $line->amount('amount');
            if (! self::isZero($amount)) {
                $revenue[] = RoleLine::credit(AccountRole::Revenue, $amount, line: $line);
            }
        }
        if ($revenue === []) {
            $split   = false;
            $revenue = [RoleLine::credit(AccountRole::Revenue, $total)];
        }

        $lines = [RoleLine::debit(AccountRole::Receivable, $total)];
        if ($split) {
            $lines[] = RoleLine::debit(AccountRole::Discount, $discount);
        }
        $lines = [...$lines, ...$revenue];

        if ($ctx->isReturn()) {
            $lines = array_map(static fn (RoleLine $line): RoleLine => new RoleLine(
                $line->role,
                $line->side === RoleLine::DEBIT ? RoleLine::CREDIT : RoleLine::DEBIT,
                $line->amount,
                $line->description,
                $line->line,
            ), $lines);
        }

        return [new RoleJournalDraft('default', $lines)];
    }
}
