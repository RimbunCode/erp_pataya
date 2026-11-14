<?php

namespace App\Services\Finances\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\PurchaseInvoice;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` Purchase Invoice (Finance Fase 2, Task 8.2). Milik domain Finances (P-8). Menghasilkan konteks
 * untuk dua jurnal (`stock` bila `stock_total` > 0 dan bukan retur, dan `expense`): nilai (`total`, `stock_total`),
 * arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama. Kolom akun dokumen
 * (`credit_account_id`/`expanse_head_account_id`) tidak dibaca (Requirement 7.4): `payable`, `expense` (dipetakan ke
 * SRNB demi parity, T-9), `stock`, dan `stock_received_but_not_billed` di-resolve dari profil. Baris membawa atribut
 * barang untuk aturan bersyarat `expense`.
 */
final class PurchaseInvoicePostingContextFactory {
    public function __construct(private readonly InvoiceLineAttributesBuilder $lines = new InvoiceLineAttributesBuilder) {}

    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forPosting`) hanya dibangun
     * bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(PurchaseInvoice $purchaseInvoice, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(PostingDocumentType::PurchaseInvoice, $purchaseInvoice->getMorphClass(), (string) $purchaseInvoice->getKey(), $transactionDate, null, []);
    }

    public function forPosting(PurchaseInvoice $purchaseInvoice, float $totalStockGl, float $totalAmount, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        $items = $purchaseInvoice->items()->with(['item' => fn ($query) => $query->withTrashed()])->get();

        return new PostingContext(
            documentType: PostingDocumentType::PurchaseInvoice,
            sourceType: $purchaseInvoice->getMorphClass(),
            sourceId: (string) $purchaseInvoice->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalAmount, 'stock_total' => $totalStockGl],
            flags: ['is_return' => $isReturn],
            lines: $this->lines->build($items, $totalAmount, PostingDocumentType::PurchaseInvoice->value, (string) $purchaseInvoice->getKey()),
        );
    }
}
