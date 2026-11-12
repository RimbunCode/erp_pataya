<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use LogicException;

/**
 * Payment Entry (design.md, tabel arah): satu jurnal `default` sebesar `amounts['paid_amount']` (jumlah entri ini,
 * bukan kumulatif). Arah mengikuti `flags['payment_type']`; lawan `cash_or_bank` ditentukan `flags['paymentable_kind']`.
 *
 * - `receive`: debit `cash_or_bank`, kredit lawan.
 * - `pay`: debit lawan, kredit `cash_or_bank`.
 * - lawan: `sales_invoice` -> `receivable`, `purchase_invoice` -> `payable`.
 *
 * `internal_transfer` tidak didukung (T-4: jalur lama gagal di `onApproved`; butuh dua akun bank, di luar bentuk
 * `masterAccounts[role]`); rule gagal keras alih-alih menebak. Arah retur memakai tabel yang sama (T-3, menunggu
 * konfirmasi pemilik produk).
 */
final class PaymentEntryRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PaymentEntry;
    }

    public function build(PostingContext $ctx): array {
        $counterpart = match ($ctx->flag('paymentable_kind')) {
            'sales_invoice'    => AccountRole::Receivable,
            'purchase_invoice' => AccountRole::Payable,
            default            => throw new LogicException('Unsupported paymentable_kind for payment entry posting: ' . json_encode($ctx->flag('paymentable_kind'))),
        };

        $amount = $ctx->amount('paid_amount');

        return match ($ctx->flag('payment_type')) {
            'receive' => self::compact([self::pair('default', AccountRole::CashOrBank, $counterpart, $amount)]),
            'pay'     => self::compact([self::pair('default', $counterpart, AccountRole::CashOrBank, $amount)]),
            default   => throw new LogicException('Unsupported payment_type for payment entry posting: ' . json_encode($ctx->flag('payment_type'))),
        };
    }
}
