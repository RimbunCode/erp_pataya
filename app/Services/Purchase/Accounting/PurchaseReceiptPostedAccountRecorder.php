<?php

namespace App\Services\Purchase\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Purchase Receipt (Requirement 13.2, Task 12.1 bagian B), senyap lewat
 * query builder (tanpa event model dan audit log): `purchase_receipt_items.posted_account_id` <- akun `stock` per
 * baris, dibatasi ke baris milik dokumen ini. Retur menukar sisi jurnal, tetapi akun stock barisnya tetap dicatat.
 */
final class PurchaseReceiptPostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseReceipt;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        foreach ($notes->byLine(AccountRole::Stock->value) as $lineId => $accountId) {
            DB::table('purchase_receipt_items')
                ->where('id', $lineId)
                ->where('purchase_receipt_id', $ctx->sourceId)
                ->update(['posted_account_id' => $accountId]);
        }
    }
}
