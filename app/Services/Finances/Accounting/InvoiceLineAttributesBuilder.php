<?php

namespace App\Services\Finances\Accounting;

use App\Services\Finances\Posting\Contexts\LineAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Membentuk `LineAttributes` per baris invoice untuk aturan akun bersyarat (Requirement 12.4; Finance Fase 2, Task 8.2).
 * Dipakai pabrik konteks Sales Invoice dan Purchase Invoice.
 *
 * Jumlah baris = `basic_amount - discount_amount + tax_amount`, persis rumus total yang dipakai approve
 * (`Σ(basic_amount - discount_amount) + Σ tax_amount`; basis pajak dan jumlah tidak diubah di Fase 2, pajak ikut dalam jumlah baris;
 * pemisahan baris pajak Fase 3 dilakukan rule dengan mengurangi bagian pajak baris, bukan oleh builder). Atribut barang dari varian item (`type`, `is_stock_item`, `category_id`); baris tanpa item
 * (mis. baris aset) membawa atribut null sehingga aturan berkondisi barang tidak cocok untuknya.
 *
 * Bila jumlah baris tidak berjumlah `total` dalam toleransi (data tak konsisten, mis. retry memakai total tersimpan),
 * daftar baris dikosongkan dan dicatat: rule lalu memakai satu baris sebesar `total` (persis jalur lama) daripada
 * menghasilkan jurnal tak seimbang.
 */
final class InvoiceLineAttributesBuilder {
    private const TOLERANCE = 0.01;

    /**
     * @param  iterable<Model>  $items  baris invoice dengan relasi `item` (varian) dimuat
     * @return list<LineAttributes>
     */
    public function build(iterable $items, float $total, string $documentType, string $sourceId): array {
        $lines = [];
        $sum   = 0.0;

        foreach ($items as $item) {
            $amount = (float) $item->basic_amount - (float) $item->discount_amount + (float) $item->tax_amount;
            $sum += $amount;

            $variant = $item->item;
            $lines[] = new LineAttributes(
                // `gross_amount`/`discount_amount` (Requirement 14.2): kotor = basic + pajak (pajak ikut dalam jumlah baris; rule Fase 3 mengurangi bagian pajak bila dipisah) =
                // bersih + diskon alokasi baris. `amount` (bersih) tetap menjadi dasar rumus, toleransi, dan fallback.
                amounts: [
                    'amount'          => $amount,
                    'gross_amount'    => (float) $item->basic_amount + (float) $item->tax_amount,
                    'discount_amount' => (float) $item->discount_amount,
                ],
                itemType: $variant?->type !== null ? (string) $variant->type : null,
                isStockItem: $variant?->is_stock_item !== null ? (bool) $variant->is_stock_item : null,
                itemCategoryId: $variant?->category_id !== null ? (string) $variant->category_id : null,
                lineId: (string) $item->getKey(),
            );
        }

        if ($lines !== [] && abs($sum - $total) > self::TOLERANCE) {
            Log::warning('posting.invoice_lines_total_mismatch', [
                'document_type' => $documentType,
                'source_id'     => $sourceId,
                'lines_total'   => $sum,
                'total'         => $total,
            ]);

            return [];
        }

        return $lines;
    }

    /**
     * Jumlah bernama tingkat dokumen untuk posting diskon terpisah (Requirement 14.2-14.3): Σ `gross_amount` dan
     * Σ `discount_amount` baris. `$nonStockOnly` (Purchase Invoice) hanya menjumlah baris yang tegas non-stok
     * (`isStockItem === false`); baris stok dan baris tanpa atribut stok (null) tetap bersih.
     *
     * @param  list<LineAttributes>  $lines
     * @return array{gross_amount: float, discount_amount: float}
     */
    public function discountTotals(array $lines, bool $nonStockOnly = false): array {
        $gross    = 0.0;
        $discount = 0.0;

        foreach ($lines as $line) {
            if ($nonStockOnly && $line->isStockItem !== false) {
                continue;
            }

            $gross += $line->amount('gross_amount');
            $discount += $line->amount('discount_amount');
        }

        return ['gross_amount' => $gross, 'discount_amount' => $discount];
    }
}
