<?php

namespace App\Services\Finances;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class DocumentDiscountCalculator {
    public const string BASIS_NET_TOTAL   = 'net_total';
    public const string BASIS_GRAND_TOTAL = 'grand_total';

    /**
     * Alokasikan diskon dokumen header ($document->discount_on/discount_rate/discount_amount)
     * ke tiap item baris ($items, masing-masing punya basic_amount & tax_rate). basic_amount
     * (kotor, quantity*rate/price) TETAP generated column -- diskon TIDAK menimpa basic_amount,
     * melainkan ditulis ke kolom terpisah discount_amount, konsisten dengan
     * PurchaseInvoiceItem/SalesInvoiceItem (lihat migration
     * add_discount_amount_to_purchase_order_items_table). Beda dari
     * applyDiscountColumnToItems() (varian Invoice): PurchaseOrderItem/SalesOrderItem tidak
     * punya kolom dpp_amount sebagai perantara, jadi tax_amount/amount TETAP kolom biasa yang
     * ditulis langsung di sini, bukan generated dari discount_amount.
     *
     * @param  Collection<int, Model>  $items  item model dengan attribute basic_amount & tax_rate
     * @return array{basic_amount: float, tax_amount: float} total basic_amount(net)/tax_amount header
     */
    public static function applyToItems(Model $document, Collection $items): array {
        $lines = $items->map(fn (Model $item) => [
            'basic_amount' => $item->basic_amount,
            'tax_rate'     => $item->tax_rate,
        ])->all();

        // discount_amount selalu dipakai sebagai nilai otoritatif (bukan discount_rate) --
        // FE (AdditionalDiscount.jsx) sudah menyinkronkan discount_amount setiap kali user
        // mengubah discount_rate ATAU discount_amount, jadi discount_amount yang terkirim ke
        // backend selalu representasi absolut terkini, tanpa perlu transport latestDiscountKey
        // (state FE-only, tidak ada kolomnya di DB) ke backend.
        $allocated = self::allocate(
            $lines,
            $document->discount_on,
            $document->discount_rate ?? 0,
            $document->discount_amount ?? 0,
            'discount_amount',
        );

        $basicAmount = 0;
        $taxAmount   = 0;
        foreach ($items->values() as $index => $item) {
            $line            = $lines[$index];
            $discountForLine = round($line['basic_amount'] - $allocated[$index]['basic_amount'], 2);
            $item->forceFill([
                'discount_amount' => $discountForLine,
                'tax_amount'      => $allocated[$index]['tax_amount'],
                'amount'          => $allocated[$index]['amount'],
            ])->save();
            $basicAmount += $allocated[$index]['basic_amount'];
            $taxAmount += $allocated[$index]['tax_amount'];
        }

        return ['basic_amount' => $basicAmount, 'tax_amount' => $taxAmount];
    }

    /**
     * Alokasi diskon dokumen header untuk Invoice (Sales/Purchase). `basic_amount` (kotor, quantity*harga) TETAP
     * generated column; diskon TIDAK menimpa `basic_amount`, melainkan ditulis ke `discount_amount` oleh pemanggil.
     * Sejak Bagian B (Finance Fase 3, Requirement 12.3) `dpp_amount`/`tax_amount` bukan lagi generated: service
     * menghitungnya lewat `TaxEngine` dari basis `basic_amount - discount_amount`, sehingga method ini HANYA
     * mengembalikan diskon per baris (tidak menyimpan apa pun, tidak memegang faktor DPP).
     *
     * Faktor DPP, tarif, dan perilaku (`additive`/`withholding`) tiap baris datang dari versi aturan pajak pada
     * tanggal dokumen (`$lineRules` per `tax_id`, dari `DocumentTaxRules::lineParameters()`), bukan konstanta.
     * Baris tanpa pajak tidak punya aturan (tarif 0). Pada basis `grand_total`, pajak `withholding` tidak
     * menambah total sehingga tidak ikut basis.
     *
     * @param  Collection<int, Model>  $items  item model dengan attribute basic_amount, tax_id (atau null)
     * @param  array<string, array{rate: float, dpp_factor: float, additive: bool}>  $lineRules
     * @return array<int, float> diskon per baris (2 desimal), terurut seperti `$items->values()`
     */
    public static function invoiceItemDiscounts(Model $document, Collection $items, array $lineRules): array {
        $lines = [];
        foreach ($items->values() as $item) {
            $rule    = filled($item->tax_id) ? ($lineRules[(string) $item->tax_id] ?? null) : null;
            $lines[] = [
                'basic_amount' => $item->basic_amount,
                'tax_rate'     => $rule['rate'] ?? 0,
                'dpp_factor'   => $rule['dpp_factor'] ?? 1.0,
                'additive'     => $rule['additive'] ?? true,
            ];
        }

        $allocated = self::allocate(
            $lines,
            $document->discount_on,
            $document->discount_rate ?? 0,
            $document->discount_amount ?? 0,
            'discount_amount',
            1.0,
        );

        $discounts = [];
        foreach ($lines as $index => $line) {
            $discounts[$index] = round($line['basic_amount'] - $allocated[$index]['basic_amount'], 2);
        }

        return $discounts;
    }

    /**
     * Alokasikan diskon dokumen pro-rata ke tiap baris, lalu hitung ulang tax_amount
     * dari basic_amount yang sudah dikurangi diskon (bukan lump-sum dari total akhir).
     *
     * @param  array<int, array{basic_amount: float, tax_rate: float, dpp_factor?: float, additive?: bool}>  $lines  `dpp_factor` (opsional) menimpa `$dppFactor` untuk baris itu; `additive` false (pajak `withholding`) = pajak baris tidak menambah total
     * @param  string|null  $discountOn  'net_total' | 'grand_total' | null (tanpa diskon)
     * @param  string|null  $latestDiscountKey  'discount_rate' | 'discount_amount' -- menentukan input mana yang otoritatif
     * @param  float|null  $dppFactor  null = pajak dihitung basic_amount*tax_rate/100 langsung (PO/SO).
     *                                 Diisi (mis. 11/12) = pajak dihitung lewat basis DPP Nilai Lain: (basic_amount*dppFactor)*tax_rate/100
     *                                 (Purchase/Sales Invoice -- lihat migration add_dpp_amount_to_*_invoice_items_table).
     * @return array<int, array{basic_amount: float, tax_amount: float, amount: float}>
     */
    public static function allocate(
        array $lines,
        ?string $discountOn,
        float $discountRate,
        float $discountAmount,
        ?string $latestDiscountKey = 'discount_rate',
        ?float $dppFactor = null,
    ): array {
        if ($lines === []) {
            return [];
        }

        $taxBasisOf = function (float $basicAmount, array $line) use ($dppFactor): float {
            $factor = $line['dpp_factor'] ?? $dppFactor;

            return $factor === null ? $basicAmount : $basicAmount * $factor;
        };
        // Pajak yang tidak menambah total (withholding) tidak ikut basis `grand_total` dan tidak mengurangi diskon.
        $addedRate = fn (array $line): float => ($line['additive'] ?? true) ? (float) $line['tax_rate'] : 0.0;

        $preTax = array_map(
            fn (array $line) => $taxBasisOf($line['basic_amount'], $line) * $addedRate($line) / 100,
            $lines,
        );

        if ($discountOn !== self::BASIS_NET_TOTAL && $discountOn !== self::BASIS_GRAND_TOTAL) {
            return self::toResult($lines, array_map(fn ($i) => $lines[$i]['basic_amount'], array_keys($lines)), $preTax);
        }

        $sumBasic = array_sum(array_column($lines, 'basic_amount'));
        $sumGross = $sumBasic + array_sum($preTax);
        $basis    = $discountOn === self::BASIS_NET_TOTAL ? $sumBasic : $sumGross;

        $discountValue = $latestDiscountKey === 'discount_amount'
            ? $discountAmount
            : $basis * $discountRate / 100;

        if ($basis > 0 && $discountValue > $basis + 1e-9) {
            throw ValidationException::withMessages([
                'discount_amount' => 'Diskon tidak boleh melebihi basis (' . ($discountOn === self::BASIS_NET_TOTAL ? 'Total Bersih' : 'Total Keseluruhan') . ').',
            ]);
        }
        $discountValue = $basis > 0 ? min($discountValue, $basis) : 0.0;

        $newBasicAmounts = [];

        if ($discountOn === self::BASIS_NET_TOTAL) {
            foreach ($lines as $i => $line) {
                $share               = $sumBasic > 0 ? $line['basic_amount'] / $sumBasic : 0;
                $allocated           = $discountValue * $share;
                $newBasicAmounts[$i] = max(0.0, $line['basic_amount'] - $allocated);
            }
        } else {
            foreach ($lines as $i => $line) {
                $gross               = $line['basic_amount'] + $preTax[$i];
                $share               = $sumGross > 0 ? $gross / $sumGross : 0;
                $allocated           = $discountValue * $share;
                $reduction           = $allocated / (1 + $addedRate($line) / 100);
                $newBasicAmounts[$i] = max(0.0, $line['basic_amount'] - $reduction);
            }
        }

        $newTaxAmounts = [];
        foreach ($lines as $i => $line) {
            $newTaxAmounts[$i] = $taxBasisOf($newBasicAmounts[$i], $line) * $addedRate($line) / 100;
        }

        return self::toResult($lines, $newBasicAmounts, $newTaxAmounts);
    }

    /**
     * Bulatkan tiap baris ke 2 desimal, dorong sisa selisih pembulatan ke baris dengan
     * basic_amount terbesar, supaya Σ(basic_amount)/Σ(tax_amount) hasil rounding tetap
     * sama persis dengan jumlah sebelum rounding (invarian header == Σ baris).
     *
     * @param  array<int, array{basic_amount: float, tax_rate: float}>  $lines
     * @param  array<int, float>  $basicAmounts
     * @param  array<int, float>  $taxAmounts
     * @return array<int, array{basic_amount: float, tax_amount: float, amount: float}>
     */
    private static function toResult(array $lines, array $basicAmounts, array $taxAmounts): array {
        $roundedBasic = self::roundWithResidual($basicAmounts);
        $roundedTax   = self::roundWithResidual($taxAmounts);

        $result = [];
        foreach (array_keys($lines) as $i) {
            $result[$i] = [
                'basic_amount' => $roundedBasic[$i],
                'tax_amount'   => $roundedTax[$i],
                'amount'       => round($roundedBasic[$i] + $roundedTax[$i], 2),
            ];
        }

        return $result;
    }

    /**
     * @param  array<int, float>  $values
     * @return array<int, float>
     */
    private static function roundWithResidual(array $values): array {
        if ($values === []) {
            return [];
        }

        $rounded  = array_map(fn ($v) => round($v, 2), $values);
        $residual = round(array_sum($values) - array_sum($rounded), 2);

        if (abs($residual) >= 0.01) {
            $largestIndex           = array_keys($values, max($values))[0];
            $rounded[$largestIndex] = round($rounded[$largestIndex] + $residual, 2);
        }

        return $rounded;
    }
}
