<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Purchase Receipt (design.md, peta rule): satu jurnal `default`, debit `stock`, kredit
 * `stock_received_but_not_billed` sebesar `amounts['total']` (nilai rate untuk GL); retur menukar sisi
 * (`flags['is_return']`). `stock` dipecah per baris (`lines[].amount`, Task 12.1) supaya akunnya peka-barang dan dicatat
 * per baris; `stock_received_but_not_billed` tetap satu baris tingkat dokumen. Bila `lines` kosong atau jumlahnya tidak
 * sama dengan `total` (mis. nilai hitung ulang jalur retry), jatuh ke satu baris `stock` tanpa line seperti semula.
 */
final class PurchaseReceiptRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseReceipt;
    }

    public function build(PostingContext $ctx): array {
        $total = $ctx->amount('total');
        if (self::isZero($total)) {
            return [];
        }

        $stockAmounts = [];
        foreach ($ctx->lines as $line) {
            if (! self::isZero($line->amount('amount'))) {
                $stockAmounts[] = [$line->amount('amount'), $line];
            }
        }
        $sum = array_sum(array_column($stockAmounts, 0));
        if ($stockAmounts === [] || abs($sum - $total) > 0.005) {
            $stockAmounts = [[$total, null]];
        }

        $isReturn = $ctx->isReturn();
        $stock    = [];
        foreach ($stockAmounts as [$amount, $line]) {
            $stock[] = $isReturn
                ? RoleLine::credit(AccountRole::Stock, $amount, line: $line)
                : RoleLine::debit(AccountRole::Stock, $amount, line: $line);
        }
        $srnb = $isReturn
            ? RoleLine::debit(AccountRole::StockReceivedButNotBilled, $total)
            : RoleLine::credit(AccountRole::StockReceivedButNotBilled, $total);
        $lines = $isReturn ? [$srnb, ...$stock] : [...$stock, $srnb];

        return self::compact([new RoleJournalDraft('default', $lines)]);
    }
}
