<?php

namespace App\Services\Purchase\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Purchase Receipt (Finance Fase 2, Task 12.4; Requirement 13.4; T-11). Milik domain
 * Purchase (P-8), pasangan `PurchaseReceiptPostedAccountRecorder`.
 *
 * Tanpa pratinjau: nilai GL per baris (`lineAmountsForGL`) baru dihitung saat approve bersama alokasi stok, sehingga
 * pratinjau tidak dapat dibangun tanpa efek samping. Sebelum approve panel menyatakan akun ditentukan saat approve;
 * sesudahnya memakai kolom catatan.
 */
final class PurchaseReceiptPanelSource implements PanelSource {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseReceipt;
    }

    public function previewContext(Model $document): ?PostingContext {
        return null;
    }

    public function previewIsEstimate(): bool {
        return false;
    }

    public function recorded(Model $document): array {
        /** @var PurchaseReceipt $document */
        return RecordedColumns::perLine(AccountRole::Stock->value, $document->items()->pluck('posted_account_id'));
    }
}
