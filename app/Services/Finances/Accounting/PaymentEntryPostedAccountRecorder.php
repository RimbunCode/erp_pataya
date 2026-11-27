<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Payment Entry (Requirement 13.2, Task 12.1): `account_paid_to_id` dan
 * `account_paid_from_id` mengikuti arah `payment_type` (sama dengan `PaymentEntryRule`). `receive`: ke = `cash_or_bank`,
 * dari = `receivable`; `pay`: dari = `cash_or_bank`, ke = `payable`. Tulis senyap lewat query builder (tanpa event
 * model dan audit log), dibatasi ke dokumen ini.
 */
final class PaymentEntryPostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PaymentEntry;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        $cash = $notes->accountFor(AccountRole::CashOrBank->value);

        // Peran lawan mengikuti `paymentable_kind`, sama seperti `PaymentEntryRule` (bukan `payment_type`), agar tetap
        // benar bila refund retur kelak mengizinkan `pay` untuk Sales Invoice (T-3).
        $counterpartRole = match ($ctx->flag('paymentable_kind')) {
            'sales_invoice'    => AccountRole::Receivable->value,
            'purchase_invoice' => AccountRole::Payable->value,
            default            => null,
        };
        $counterpart = $counterpartRole === null ? null : $notes->accountFor($counterpartRole);

        $columns = match ($ctx->flag('payment_type')) {
            'receive' => ['account_paid_to_id' => $cash, 'account_paid_from_id' => $counterpart],
            'pay'     => ['account_paid_from_id' => $cash, 'account_paid_to_id' => $counterpart],
            default   => [],
        };

        $columns = array_filter($columns, static fn (?string $accountId): bool => $accountId !== null);
        if ($columns === []) {
            return;
        }

        DB::table('payment_entries')->where('id', $ctx->sourceId)->update($columns);
    }
}
