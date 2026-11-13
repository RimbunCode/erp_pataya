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

        $revenue = [];
        foreach ($ctx->lines as $line) {
            if (! self::isZero($line->amount('amount'))) {
                $revenue[] = RoleLine::credit(AccountRole::Revenue, $line->amount('amount'), line: $line);
            }
        }
        if ($revenue === []) {
            $revenue = [RoleLine::credit(AccountRole::Revenue, $total)];
        }

        $lines = [RoleLine::debit(AccountRole::Receivable, $total), ...$revenue];

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
