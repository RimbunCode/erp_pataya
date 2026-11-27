<?php

namespace App\Services\Finances\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\PurchaseInvoice;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\DiscountSplit\DiscountSplitResolver;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;

/**
 * Pabrik `PostingContext` Purchase Invoice (Finance Fase 2, Task 8.2). Milik domain Finances (P-8). Menghasilkan konteks
 * untuk dua jurnal (`stock` bila `stock_total` > 0 dan bukan retur, dan `expense`): nilai (`total`, `stock_total`),
 * arah retur, tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama. Kolom akun dokumen
 * (`credit_account_id`/`expanse_head_account_id`) tidak dibaca (Requirement 7.4): `payable`, `expense` (dipetakan ke
 * SRNB demi parity, T-9), `stock`, dan `stock_received_but_not_billed` di-resolve dari profil. Baris membawa atribut
 * barang untuk aturan bersyarat `expense`.
 *
 * Posting diskon terpisah (Requirement 14.3, Task 13.1): `gross_amount` dan `discount_amount` tingkat dokumen hanya
 * menjumlah baris yang tegas non-stok (`is_stock_item === false`); baris stok dan baris tanpa atribut stok (null,
 * mis. baris aset) tetap bersih (`is_stock_item` null diperlakukan stok; keputusan pemilik produk 22 November 2026). Flag `discount_split` dari `DiscountSplitResolver` (retur mengikuti invoice asal);
 * dipaksa false (dan dicatat) bila daftar baris dikosongkan builder. `stock_total` tidak berubah.
 */
final class PurchaseInvoicePostingContextFactory {
    public function __construct(
        private readonly InvoiceLineAttributesBuilder $lines = new InvoiceLineAttributesBuilder,
        private readonly ?DiscountSplitResolver $discountSplit = null,
    ) {}

    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forPosting`) hanya dibangun
     * bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(PurchaseInvoice $purchaseInvoice, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(PostingDocumentType::PurchaseInvoice, $purchaseInvoice->getMorphClass(), (string) $purchaseInvoice->getKey(), $transactionDate, null, []);
    }

    public function forPosting(PurchaseInvoice $purchaseInvoice, float $totalStockGl, float $totalAmount, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        $items = $purchaseInvoice->items()->with(['item' => fn ($query) => $query->withTrashed()])->get();
        $lines = $this->lines->build($items, $totalAmount, PostingDocumentType::PurchaseInvoice->value, (string) $purchaseInvoice->getKey());

        return new PostingContext(
            documentType: PostingDocumentType::PurchaseInvoice,
            sourceType: $purchaseInvoice->getMorphClass(),
            sourceId: (string) $purchaseInvoice->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalAmount, 'stock_total' => $totalStockGl, ...$this->lines->discountTotals($lines, nonStockOnly: true)],
            flags: ['is_return' => $isReturn, 'discount_split' => $this->discountSplitActive($lines, $transactionDate, $purchaseInvoice, $isReturn)],
            lines: $lines,
        );
    }

    /**
     * @param  list<LineAttributes>  $lines
     */
    private function discountSplitActive(array $lines, CarbonInterface $transactionDate, PurchaseInvoice $purchaseInvoice, bool $isReturn): bool {
        $resolver = $this->discountSplit ?? app(DiscountSplitResolver::class);
        // Retur mengikuti bentuk invoice asal (keputusan pemilik produk 22 November 2026).
        $originId = $isReturn ? $purchaseInvoice->return_against_id : null;
        if (! $resolver->isActiveForDocument(PostingDocumentType::PurchaseInvoice, $transactionDate, $purchaseInvoice->getMorphClass(), $originId === null ? null : (string) $originId)) {
            return false;
        }

        if ($lines === []) {
            Log::warning('posting.discount_split_skipped_lines_mismatch', [
                'document_type' => PostingDocumentType::PurchaseInvoice->value,
                'source_id'     => (string) $purchaseInvoice->getKey(),
            ]);

            return false;
        }

        return true;
    }
}
