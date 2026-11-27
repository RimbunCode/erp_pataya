<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\PurchaseInvoice;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Purchase Invoice (Finance Fase 2, Task 12.4; Requirement 13.4). Milik domain
 * Finances (P-8), pasangan `PurchaseInvoicePostedAccountRecorder`.
 *
 * Pratinjau perkiraan: nilai stok (`totalStockGL`) baru pasti saat approve karena dihitung bersama pembaruan stok yang
 * menulis ke DB. Pratinjau memperkirakannya dari baris barang stok; ini hanya memengaruhi apakah jurnal `stock` ikut
 * tampil, bukan akun tiap peran.
 */
final class PurchaseInvoicePanelSource implements PanelSource {
    public function __construct(private readonly PurchaseInvoicePostingContextFactory $factory) {}

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PurchaseInvoice;
    }

    public function previewContext(Model $document): ?PostingContext {
        /** @var PurchaseInvoice $document */
        $total = 0.0;
        $stock = 0.0;
        foreach ($document->items()->with(['item' => fn ($query) => $query->withTrashed()])->get() as $item) {
            $amount = (float) $item->basic_amount - (float) $item->discount_amount;
            $total += $amount + (float) $item->tax_amount;
            if ($item->item?->is_stock_item) {
                $stock += $amount;
            }
        }

        $isReturn = $document->return_against_id !== null;

        return $this->factory->forPosting($document, $isReturn ? 0.0 : $stock, $total, $isReturn, now(), preview: true);
    }

    public function previewIsEstimate(): bool {
        return true;
    }

    public function recorded(Model $document): array {
        /** @var PurchaseInvoice $document */
        return [
            ...RecordedColumns::single(AccountRole::Payable->value, $document->credit_account_id),
            ...RecordedColumns::perLine(AccountRole::Expense->value, $document->items()->pluck('posted_account_id'), $document->expanse_head_account_id),
        ];
    }
}
