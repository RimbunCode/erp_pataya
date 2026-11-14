<?php

namespace App\Services\Sales\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Accounting\InvoiceLineAttributesBuilder;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Sales Invoice (Finance Fase 2, Task 8.2). Milik domain Sales (P-8). Nilai (`total`), arah retur,
 * tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama. Kolom akun dokumen
 * (`debit_account_id`/`income_account_id`) tidak dibaca (Requirement 7.4): `receivable` dan `revenue` di-resolve dari
 * profil. Baris membawa atribut barang untuk aturan bersyarat `revenue`.
 */
final class SalesInvoicePostingContextFactory {
    public function __construct(private readonly InvoiceLineAttributesBuilder $lines = new InvoiceLineAttributesBuilder) {}

    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forPosting`) hanya dibangun
     * bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(SalesInvoice $salesInvoice, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(PostingDocumentType::SalesInvoice, $salesInvoice->getMorphClass(), (string) $salesInvoice->getKey(), $transactionDate, null, []);
    }

    public function forPosting(SalesInvoice $salesInvoice, float $totalAmount, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        $items = $salesInvoice->items()->with(['item' => fn ($query) => $query->withTrashed()])->get();

        return new PostingContext(
            documentType: PostingDocumentType::SalesInvoice,
            sourceType: $salesInvoice->getMorphClass(),
            sourceId: (string) $salesInvoice->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalAmount],
            flags: ['is_return' => $isReturn],
            lines: $this->lines->build($items, $totalAmount, PostingDocumentType::SalesInvoice->value, (string) $salesInvoice->getKey()),
        );
    }
}
