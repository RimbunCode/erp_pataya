<?php

namespace App\Services\Sales\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Accounting\DocumentFxScaler;
use App\Services\Finances\Accounting\InvoiceLineAttributesBuilder;
use App\Services\Finances\Accounting\InvoiceTaxComponentsBuilder;
use App\Services\Finances\Accounting\TaxSplitResolver;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use App\Services\Finances\Posting\DiscountSplit\DiscountSplitResolver;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
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
        private readonly InvoiceTaxComponentsBuilder $taxComponents = new InvoiceTaxComponentsBuilder,
        private readonly ?TaxSplitResolver $taxSplit = null,
    ) {}

    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forPosting`) hanya dibangun
     * bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(SalesInvoice $salesInvoice, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(PostingDocumentType::SalesInvoice, $salesInvoice->getMorphClass(), (string) $salesInvoice->getKey(), $transactionDate, null, []);
    }

    public function forPosting(SalesInvoice $salesInvoice, float $totalAmount, bool $isReturn, CarbonInterface $transactionDate, bool $preview = false): PostingContext {
        $items = $salesInvoice->items()->with(['item' => fn ($query) => $query->withTrashed(), 'taxLines'])->get();
        $lines = $this->lines->build($items, $totalAmount, PostingDocumentType::SalesInvoice->value, (string) $salesInvoice->getKey());

        [$taxComponents, $taxSplitActive] = $this->taxSplitFor($salesInvoice, $items, $transactionDate, $isReturn, $preview);
        // Pajak potong (Bagian B, Requirement 12.4) tidak bergantung pada cutover: sudah keluar dari `amount` dokumen.
        $withholding = $this->taxComponents->withholdingComponents($items, false);

        // Invoice mata uang asing (Finance Fase 4, Requirement 8.1-8.2): seluruh nilai dikonversi ke mata uang dasar
        // dengan kurs dokumen; baris piutang membawa jumlah asing + kurs. Dokumen mata uang dasar tidak berubah.
        $fx             = DocumentFxScaler::fromDocument($salesInvoice);
        $controlForeign = null;
        $discountSplit  = $this->discountSplitActive($lines, $transactionDate, $salesInvoice, $isReturn);
        if ($fx !== null) {
            $controlForeign = $fx->foreign($totalAmount - $this->sum($withholding));
            $totalAmount    = $fx->base($totalAmount);
            $lines          = $fx->lines($lines);
            $components     = $fx->components([...$taxComponents, ...$withholding]);
            $withholding    = array_values(array_filter($components, static fn (TaxComponentLine $component): bool => $component->withholding));
        } else {
            $components = [...$taxComponents, ...$withholding];
        }

        return new PostingContext(
            documentType: PostingDocumentType::SalesInvoice,
            sourceType: $salesInvoice->getMorphClass(),
            sourceId: (string) $salesInvoice->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['total' => $totalAmount, 'withholding' => $this->sum($withholding), ...$this->lines->discountTotals($lines)],
            flags: ['is_return' => $isReturn, 'discount_split' => $discountSplit, 'tax_split' => $taxSplitActive],
            lines: $lines,
            taxComponents: $components,
            controlForeign: $controlForeign,
        );
    }

    /**
     * @param  list<TaxComponentLine>  $components
     */
    private function sum(array $components): float {
        return round(array_sum(array_map(static fn (TaxComponentLine $component): float => $component->amount, $components)), 6);
    }

    /**
     * Apakah jurnal Sales Invoice ini memakai bentuk diskon terpisah (kotor + baris `discount`) bila diposting pada
     * `$transactionDate`: syarat yang sama dengan `forPosting` (setting cutover terhadap tanggal posting, dan baris
     * konsisten dengan total approve `Σ(basic - diskon) + Σ pajak`). Dipakai jurnal pelepasan aset agar membalik bentuk yang
     * sama dengan yang diposting Sales Invoice, tanpa membaca jurnal yang mungkin belum terposting.
     */
    public function postsDiscountSplit(SalesInvoice $salesInvoice, CarbonInterface $transactionDate): bool {
        $resolver = $this->discountSplit ?? app(DiscountSplitResolver::class);
        if (! $resolver->isActive(PostingDocumentType::SalesInvoice, $transactionDate)) {
            return false;
        }

        $items = $salesInvoice->items()->with(['item' => fn ($query) => $query->withTrashed(), 'taxLines'])->get();
        $total = (float) $items->sum(fn ($item): float => (float) $item->basic_amount - (float) $item->discount_amount + (float) $item->tax_amount);
        $lines = $this->lines->build($items, $total, PostingDocumentType::SalesInvoice->value, (string) $salesInvoice->getKey());

        return $this->discountSplitActive($lines, $transactionDate, $salesInvoice, false);
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

    /**
     * Komponen pajak dari nilai tersimpan dan flag cutover pemisahan baris pajak (Finance Fase 3, Requirement 7.5).
     * Pemisahan aktif hanya bila tanggal jurnal >= `finance_tax_split_from.{type}` DAN ada komponen; komponen yang tidak
     * dapat dipisah (tak terklasifikasi, tanpa versi, tak dapat dikreditkan) dicatat `unsplit_tax` dan tertanam seperti
     * semula. Retur mengikuti bentuk jurnal invoice ASAL (keputusan pemilik produk 27 November 2026, selaras Q-P2-25),
     * bukan tanggal retur. `$preview` (panel akun draft) tidak mencatat log `unsplit_tax`.
     *
     * @param  iterable<Model>  $items
     * @return array{0: list<TaxComponentLine>, 1: bool}
     */
    private function taxSplitFor(SalesInvoice $salesInvoice, iterable $items, CarbonInterface $transactionDate, bool $isReturn, bool $preview): array {
        $resolver = $this->taxSplit ?? app(TaxSplitResolver::class);
        $originId = $isReturn ? $salesInvoice->return_against_id : null;
        if (! $resolver->isActiveForDocument(PostingDocumentType::SalesInvoice, $transactionDate, $salesInvoice->getMorphClass(), $originId === null ? null : (string) $originId)) {
            return [[], false];
        }

        $components = $this->taxComponents->build($items, false, $resolver->companyIsPkp());
        if (! $preview) {
            $this->taxComponents->logUnsplit($components, false, PostingDocumentType::SalesInvoice->value, (string) $salesInvoice->getKey());
        }

        return [$components, $components !== []];
    }
}
