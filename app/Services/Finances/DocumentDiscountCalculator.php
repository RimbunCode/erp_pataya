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
     * ke tiap item baris ($items, masing-masing punya basic_amount & tax_rate). Varian dokumen
     * ORDER (PurchaseOrderItem/SalesOrderItem): basic_amount (kotor, quantity*rate/price) tetap
     * generated column dan diskon TIDAK menimpanya, melainkan ditulis ke kolom discount_amount;
     * tax_amount/amount adalah kolom biasa yang ditulis langsung di sini. Varian INVOICE tidak
     * lewat metode ini: diskon per baris dihitung invoiceItemDiscounts() dan dpp/pajak/withholding
     * ditulis InvoiceItemTaxCalculator (TaxEngine) sejak konversi Bagian B.
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
     * Pajak majemuk per item (spek finance-multi-tax-per-item, Requirement 4): `$itemTaxIds` memuat id pajak terurut
     * per kunci item. Baris dengan 0 atau 1 pajak memakai bentuk satu pajak lama persis (`tax_rate`/`dpp_factor`/
     * `additive`), sehingga hasilnya identik dengan sebelum pajak majemuk; baris dengan 2 pajak atau lebih membawa
     * `taxes` (daftar `{rate, dpp_factor, additive}`) dan pajak awal baris = Σ pajak penambah. Item yang tidak ada di
     * `$itemTaxIds` memakai `[tax_id]` kolom itemnya.
     *
     * @param  Collection<int, Model>  $items  item model dengan attribute basic_amount, tax_id (atau null)
     * @param  array<string, array{rate: float, dpp_factor: float, additive: bool}>  $lineRules
     * @param  array<string, list<string>>  $itemTaxIds  id pajak terurut per kunci item
     * @return array<int, float> diskon per baris (2 desimal), terurut seperti `$items->values()`
     */
    public static function invoiceItemDiscounts(Model $document, Collection $items, array $lineRules, array $itemTaxIds = []): array {
        $lines = [];
        foreach ($items->values() as $item) {
            $ids = $itemTaxIds[(string) $item->getKey()] ?? (filled($item->tax_id) ? [(string) $item->tax_id] : []);

            if (\count($ids) > 1) {
                $lines[] = [
                    'basic_amount' => $item->basic_amount,
                    'tax_rate'     => 0,
                    'taxes'        => array_map(fn (string $id): array => [
                        'rate'       => $lineRules[$id]['rate'] ?? 0,
                        'dpp_factor' => $lineRules[$id]['dpp_factor'] ?? 1.0,
                        'additive'   => $lineRules[$id]['additive'] ?? true,
                    ], $ids),
                ];

                continue;
            }

            $rule    = $ids === [] ? null : ($lineRules[$ids[0]] ?? null);
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
     * @param  array<int, array{basic_amount: float, tax_rate: float, dpp_factor?: float, additive?: bool, taxes?: list<array{rate: float, dpp_factor?: float|null, additive?: bool}>}>  $lines  `dpp_factor` (opsional) menimpa `$dppFactor` untuk baris itu; `additive` false (pajak `withholding`) = pajak baris tidak menambah total; `taxes` (opsional, pajak majemuk) menggantikan ketiganya: pajak awal baris = Σ pajak penambah dan reduksi `grand_total` memakai Σ tarif penambah
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

        // Pajak awal baris = Σ pajak penambah: tiap pajak memakai faktor DPP-nya sendiri (`taxes[].dpp_factor`) atau,
        // pada bentuk satu pajak lama, `dpp_factor` baris / `$dppFactor`. Pajak yang tidak menambah total (withholding)
        // tidak ikut basis `grand_total` dan tidak mengurangi diskon.
        $taxesOf = static function (array $line) use ($dppFactor): array {
            if (isset($line['taxes'])) {
                return $line['taxes'];
            }

            return [[
                'rate'       => $line['tax_rate'],
                'dpp_factor' => $line['dpp_factor'] ?? $dppFactor,
                'additive'   => $line['additive'] ?? true,
            ]];
        };
        $taxOf = static function (float $basicAmount, array $line) use ($taxesOf): float {
            $total = 0.0;
            foreach ($taxesOf($line) as $tax) {
                $factor = $tax['dpp_factor'] ?? null;
                $basis  = $factor === null ? $basicAmount : $basicAmount * $factor;
                $rate   = ($tax['additive'] ?? true) ? (float) $tax['rate'] : 0.0;
                $total += $basis * $rate / 100;
            }

            return $total;
        };
        $addedRate = static function (array $line) use ($taxesOf): float {
            $total = 0.0;
            foreach ($taxesOf($line) as $tax) {
                $total += ($tax['additive'] ?? true) ? (float) $tax['rate'] : 0.0;
            }

            return $total;
        };

        $preTax = array_map(fn (array $line) => $taxOf($line['basic_amount'], $line), $lines);

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
            $newTaxAmounts[$i] = $taxOf($newBasicAmounts[$i], $line);
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
