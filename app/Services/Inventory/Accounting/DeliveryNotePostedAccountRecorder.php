<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke baris Delivery Note (Requirement 13.2, Task 12.1 bagian B), senyap lewat
 * query builder (tanpa event model dan audit log) dan dibatasi ke dokumen ini:
 *
 * - `delivery_note_items.posted_account_id` <- akun `cost_of_goods_sold` per baris;
 * - `delivery_note_items.posted_stock_account_id` <- akun `stock` per baris.
 *
 * Baris tanpa catatan (aset, jasa, non-stok, atau jurnal jatuh ke bentuk tingkat dokumen) tidak disentuh.
 */
final class DeliveryNotePostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::DeliveryNote;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        $columns = [
            'posted_account_id'       => $notes->byLine(AccountRole::CostOfGoodsSold->value),
            'posted_stock_account_id' => $notes->byLine(AccountRole::Stock->value),
        ];

        foreach ($columns as $column => $byLine) {
            foreach ($byLine as $lineId => $accountId) {
                DB::table('delivery_note_items')
                    ->where('id', $lineId)
                    ->where('delivery_note_id', $ctx->sourceId)
                    ->update([$column => $accountId]);
            }
        }
    }
}
