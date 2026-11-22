<?php

namespace App\Services\Sales\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Accounting\InvoiceLineAttributesBuilder;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\DiscountSplit\DiscountSplitResolver;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;

/**
 * Pabrik `PostingContext` Sales Invoice (Finance Fase 2, Task 8.2). Milik domain Sales (P-8). Nilai (`total`), arah retur,
 * tanggal, `branchId` null, dan `sourceType` FQCN sama dengan jalur `postPair` lama. Kolom akun dokumen
 * (`debit_account_id`/`income_account_id`) tidak dibaca (Requirement 7.4): `receivable` dan `revenue` di-resolve dari
 * profil. Baris membawa atribut barang untuk aturan bersyarat `revenue`.
 *
 * Posting diskon terpisah (Requirement 14, Task 13.1): konteks membawa jumlah bernama `gross_amount` dan
 * `discount_amount` (tingkat dokumen = Σ baris, bukan `sales_invoices.discount_amount` header, karena pada basis
 * `grand_total` header memuat porsi pajak sedangkan diskon baris adalah pengurang DPP) serta flag `discount_split`
 * dari `DiscountSplitResolver` (tanggal jurnal terhadap setting cutover; retur mengikuti invoice asal, keputusan 22 November 2026). Bila daftar baris dikosongkan builder
 * (total baris tak konsisten dengan `total`), flag dipaksa false dan dicatat: jurnal tetap bersih (konservatif).
 */
final class SalesInvoicePostingContextFactory {
    public function __construct(
        private readonly InvoiceLineAttributesBuilder $lines = new InvoiceLineAttributesBuilder,
        private readonly ?DiscountSplitResolver $discountSplit = null,
    ) {}

    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forPosting`) hanya dibangun
     * bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(SalesInvoice $salesInvoice, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(PostingDocumentType::SalesInvoice, $salesInvoice->getMorphClass(), (string) $salesInvoice->getKey(), $transactionDate, null, []);
    }

    public function forPosting(SalesInvoice $salesInvoice, float $totalAmount, bool $isReturn, CarbonInterface $transactionDate): PostingContext {
        $items = $salesInvoice->items()->with(['item' => fn ($query) => $query->withTrashed()])->get();
        $lines = $this->lines->build($items, $totalAmount, PostingDocumentType::SalesInvoice->value, (string) $salesInvoice->getKey());

        return new PostingContext(
            documentType: PostingDocumentType::SalesInvoice,
            sourceType: $salesInvoice->getMorphClass(),
            sourceId: (string) $salesInvoice->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalAmount, ...$this->lines->discountTotals($lines)],
            flags: ['is_return' => $isReturn, 'discount_split' => $this->discountSplitActive($lines, $transactionDate, $salesInvoice, $isReturn)],
            lines: $lines,
        );
    }

    /**
     * @param  list<LineAttributes>  $lines
     */
    private function discountSplitActive(array $lines, CarbonInterface $transactionDate, SalesInvoice $salesInvoice, bool $isReturn): bool {
        $resolver = $this->discountSplit ?? app(DiscountSplitResolver::class);
        // Retur mengikuti bentuk invoice asal (keputusan pemilik produk 22 November 2026).
        $originId = $isReturn ? $salesInvoice->return_against_id : null;
        if (! $resolver->isActiveForDocument(PostingDocumentType::SalesInvoice, $transactionDate, $salesInvoice->getMorphClass(), $originId === null ? null : (string) $originId)) {
            return false;
        }

        if ($lines === []) {
            Log::warning('posting.discount_split_skipped_lines_mismatch', [
                'document_type' => PostingDocumentType::SalesInvoice->value,
                'source_id'     => (string) $salesInvoice->getKey(),
            ]);

            return false;
        }

        return true;
    }
}
