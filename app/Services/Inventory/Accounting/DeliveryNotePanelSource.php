<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Inventory\DeliveryNote;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Delivery Note (Finance Fase 2, Task 12.4; Requirement 13.4; T-11). Milik domain
 * Inventory (P-8), pasangan `DeliveryNotePostedAccountRecorder`.
 *
 * Tanpa pratinjau: nilai HPP per baris (`valuation_rates`) baru dihitung saat approve bersama pengambilan stok, sehingga
 * pratinjau tidak dapat dibangun tanpa efek samping. Sebelum approve panel menyatakan akun ditentukan saat approve;
 * sesudahnya memakai kolom catatan.
 */
final class DeliveryNotePanelSource implements PanelSource {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::DeliveryNote;
    }

    public function previewContext(Model $document): ?PostingContext {
        return null;
    }

    public function previewIsEstimate(): bool {
        return false;
    }

    public function recorded(Model $document): array {
        /** @var DeliveryNote $document */
        $items = $document->items()->get(['posted_account_id', 'posted_stock_account_id']);

        return [
            ...RecordedColumns::perLine(AccountRole::CostOfGoodsSold->value, $items->pluck('posted_account_id')),
            ...RecordedColumns::perLine(AccountRole::Stock->value, $items->pluck('posted_stock_account_id')),
        ];
    }
}
