<?php

namespace App\Services\Sales\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Sales Invoice (Finance Fase 2, Task 12.1, Requirement 13.2). Milik domain
 * Sales (P-8), berdampingan dengan `SalesInvoicePostingContextFactory`.
 *
 * - `debit_account_id` <- akun peran `receivable` (tingkat dokumen).
 * - `income_account_id` <- akun peran `revenue` HANYA bila semua baris memakai akun yang sama, null bila beragam
 *   (keputusan pemilik produk 25 Nov 2026).
 * - `sales_invoice_items.posted_account_id` <- akun `revenue` per baris.
 *
 * Penulisan senyap lewat query builder (tanpa event model dan audit log), dibatasi ke dokumen ini.
 */
final class SalesInvoicePostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::SalesInvoice;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        DB::table((new SalesInvoice)->getTable())
            ->where((new SalesInvoice)->getKeyName(), $ctx->sourceId)
            ->update([
                'debit_account_id'  => $notes->accountFor(AccountRole::Receivable->value),
                'income_account_id' => $notes->uniformAccountFor(AccountRole::Revenue->value),
            ]);

        $itemTable = (new SalesInvoiceItem)->getTable();
        foreach ($this->lineIdsByAccount($notes->byLine(AccountRole::Revenue->value)) as $accountId => $lineIds) {
            DB::table($itemTable)
                ->where('sales_invoice_id', $ctx->sourceId)
                ->whereIn((new SalesInvoiceItem)->getKeyName(), $lineIds)
                ->update(['posted_account_id' => $accountId]);
        }
    }

    /**
     * @param  array<string, string>  $byLine  lineId => accountId
     * @return array<string, list<string>> accountId => daftar lineId
     */
    private function lineIdsByAccount(array $byLine): array {
        $grouped = [];
        foreach ($byLine as $lineId => $accountId) {
            $grouped[$accountId][] = (string) $lineId;
        }

        return $grouped;
    }
}
