<?php

namespace App\Services\Inventory\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Stock Entry termasuk Additional Cost (Finance Fase 2, Task 12.4; Requirement 13.4).
 * Milik domain Inventory (P-8), pasangan `StockEntryPostedAccountRecorder`.
 *
 * Pratinjau perkiraan: nilai dasar baris dihitung bersama pembaruan stok saat approve, jadi pratinjau memakai nilai
 * tersimpan pada draf. Akun per peran tidak bergantung pada angka itu.
 */
final class StockEntryPanelSource implements PanelSource {
    public function __construct(private readonly StockEntryPostingContextFactory $factory) {}

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::StockEntry;
    }

    public function previewContext(Model $document): ?PostingContext {
        /** @var StockEntry $document */
        $items = $document->items()->with('item')->get();

        return $this->factory->forApproval($document, $items, $document->additionalCosts()->get(), (float) $items->sum('basic_amount'), now());
    }

    public function previewIsEstimate(): bool {
        return true;
    }

    public function recorded(Model $document): array {
        /** @var StockEntry $document */
        return [
            ...RecordedColumns::perLine(AccountRole::StockAdjustment->value, $document->items()->pluck('posted_account_id'), $document->difference_account_id),
            ...RecordedColumns::perLine(AccountRole::ExpenseIncludedInValuation->value, $document->additionalCosts()->pluck('expense_account_id')),
        ];
    }
}
