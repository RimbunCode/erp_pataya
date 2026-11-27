<?php

namespace App\Services\Sales\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Sales Invoice (Finance Fase 2, Task 12.4; Requirement 13.4). Milik domain Sales
 * (P-8), pasangan `SalesInvoicePostedAccountRecorder`. Pratinjau memakai pabrik konteks yang sama dengan approve dan
 * total baris yang sama (Σ (dasar - diskon) + pajak).
 */
final class SalesInvoicePanelSource implements PanelSource {
    public function __construct(private readonly SalesInvoicePostingContextFactory $factory) {}

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::SalesInvoice;
    }

    public function previewContext(Model $document): ?PostingContext {
        /** @var SalesInvoice $document */
        $total = 0.0;
        foreach ($document->items()->get(['basic_amount', 'discount_amount', 'tax_amount']) as $item) {
            $total += (float) $item->basic_amount - (float) $item->discount_amount + (float) $item->tax_amount;
        }

        return $this->factory->forPosting($document, $total, $document->return_against_id !== null, now());
    }

    public function previewIsEstimate(): bool {
        return false;
    }

    public function recorded(Model $document): array {
        /** @var SalesInvoice $document */
        return [
            ...RecordedColumns::single(AccountRole::Receivable->value, $document->debit_account_id),
            ...RecordedColumns::perLine(AccountRole::Revenue->value, $document->items()->pluck('posted_account_id'), $document->income_account_id),
        ];
    }
}
