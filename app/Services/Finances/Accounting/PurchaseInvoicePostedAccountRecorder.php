<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Purchase Invoice (Finance Fase 2, Task 12.1, Requirement 13.2). Milik domain
 * Finances (P-8), berdampingan dengan `PurchaseInvoicePostingContextFactory`.
 *
 * - `credit_account_id` <- akun peran `payable` (tingkat dokumen).
 * - `expanse_head_account_id` <- akun peran `expense` HANYA bila semua catatan memakai akun yang sama, null bila
 *   beragam (keputusan pemilik produk 25 Nov 2026).
 * - `purchase_invoice_items.posted_account_id` <- akun `expense` per baris (hanya baris yang dibawa rule sebagai
 *   baris peran; jurnal `stock` tidak membawa baris).
 *
 * Penulisan senyap lewat query builder (tanpa event model dan audit log), dibatasi ke dokumen ini.
 */
final class PurchaseInvoicePostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseInvoice;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        DB::table((new PurchaseInvoice)->getTable())
            ->where((new PurchaseInvoice)->getKeyName(), $ctx->sourceId)
            ->update([
                'credit_account_id'       => $notes->accountFor(AccountRole::Payable->value),
                'expanse_head_account_id' => $notes->uniformAccountFor(AccountRole::Expense->value),
            ]);

        $itemTable = (new PurchaseInvoiceItem)->getTable();
        foreach ($this->lineIdsByAccount($notes->byLine(AccountRole::Expense->value)) as $accountId => $lineIds) {
            DB::table($itemTable)
                ->where('purchase_invoice_id', $ctx->sourceId)
                ->whereIn((new PurchaseInvoiceItem)->getKeyName(), $lineIds)
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
