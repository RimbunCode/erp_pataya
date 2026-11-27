<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Delivery Note (design.md, peta rule; T-11): satu jurnal `default`, debit `cost_of_goods_sold`, kredit `stock`;
 * retur menukar sisi (`flags['is_return']`).
 *
 * Kontrak konteks: `amounts['total_picked']` adalah total jurnal. Bila `lines[]` ada (`amounts['amount']` per baris)
 * dan jumlahnya sama dengan `total_picked`, kedua sisi dibuat per baris (`line:`) agar akun peka-barang dan
 * penulisan balik per baris jalan. Bila `lines[]` kosong atau jumlahnya tidak sama total, jatuh ke bentuk lama
 * (sepasang baris tingkat dokumen). Total jurnal tidak berubah: `PostingService` menggabungkan baris akun dan sisi
 * yang sama lalu membulatkan.
 */
final class DeliveryNoteRule extends BasePostingRule {
    /** Toleransi selisih jumlah baris terhadap total (di bawah satuan terkecil mata uang mana pun). */
    private const float TOLERANCE = 0.005;

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::DeliveryNote;
    }

    public function build(PostingContext $ctx): array {
        $total    = $ctx->amount('total_picked');
        $isReturn = $ctx->isReturn();

        if (self::isZero($total)) {
            return [];
        }

        $amounts = [];
        foreach ($ctx->lines as $line) {
            if (! self::isZero($line->amount('amount'))) {
                $amounts[] = [$line->amount('amount'), $line];
            }
        }

        $sum = array_sum(array_column($amounts, 0));
        if ($amounts === [] || abs($sum - $total) > self::TOLERANCE) {
            return self::compact([
                self::pair('default', AccountRole::CostOfGoodsSold, AccountRole::Stock, $total, $isReturn),
            ]);
        }

        $lines = [];
        foreach ($amounts as [$amount, $line]) {
            $lines[] = $isReturn
                ? RoleLine::debit(AccountRole::Stock, $amount, line: $line)
                : RoleLine::debit(AccountRole::CostOfGoodsSold, $amount, line: $line);
            $lines[] = $isReturn
                ? RoleLine::credit(AccountRole::CostOfGoodsSold, $amount, line: $line)
                : RoleLine::credit(AccountRole::Stock, $amount, line: $line);
        }

        return self::compact([new RoleJournalDraft('default', $lines)]);
    }
}
