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
     * ke tiap item baris ($items, masing-masing punya basic_amount & tax_rate), tulis hasilnya
     * langsung ke tiap item model (forceFill + save), lalu kembalikan total basic_amount &
     * tax_amount header. Dipakai PurchaseOrderService/SalesOrderService -- logic identik,
     * disatukan di sini supaya rule alokasi tidak terduplikasi per Service.
     *
     * @param  Collection<int, Model>  $items  item model dengan attribute basic_amount & tax_rate
     * @return array{basic_amount: float, tax_amount: float}
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
            $item->forceFill($allocated[$index])->save();
            $basicAmount += $allocated[$index]['basic_amount'];
            $taxAmount += $allocated[$index]['tax_amount'];
        }

        return ['basic_amount' => $basicAmount, 'tax_amount' => $taxAmount];
    }

    /**
     * Alokasikan diskon dokumen pro-rata ke tiap baris, lalu hitung ulang tax_amount
     * dari basic_amount yang sudah dikurangi diskon (bukan lump-sum dari total akhir).
     *
     * @param  array<int, array{basic_amount: float, tax_rate: float}>  $lines
     * @param  string|null  $discountOn  'net_total' | 'grand_total' | null (tanpa diskon)
     * @param  string|null  $latestDiscountKey  'discount_rate' | 'discount_amount' -- menentukan input mana yang otoritatif
     * @return array<int, array{basic_amount: float, tax_amount: float, amount: float}>
     */
    public static function allocate(
        array $lines,
        ?string $discountOn,
        float $discountRate,
        float $discountAmount,
        ?string $latestDiscountKey = 'discount_rate',
    ): array {
        if ($lines === []) {
            return [];
        }

        $preTax = array_map(
            fn (array $line) => $line['basic_amount'] * $line['tax_rate'] / 100,
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
                $reduction           = $allocated / (1 + $line['tax_rate'] / 100);
                $newBasicAmounts[$i] = max(0.0, $line['basic_amount'] - $reduction);
            }
        }

        $newTaxAmounts = [];
        foreach ($lines as $i => $line) {
            $newTaxAmounts[$i] = $newBasicAmounts[$i] * $line['tax_rate'] / 100;
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
