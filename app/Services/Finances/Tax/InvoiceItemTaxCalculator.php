<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Menghitung dan menyimpan `dpp_amount`, `tax_amount`, `withholding_amount` (dan `amount` pada Purchase Invoice) item
 * invoice lewat `TaxEngine` (Finance Fase 3, Bagian B, Requirement 12.3-12.4). Menggantikan kolom generated 11/12.
 *
 * Basis tiap baris = `basic_amount - discount_amount` (bersih setelah alokasi diskon dokumen). Faktor DPP dan tarif
 * dari versi aturan berlaku pada tanggal dokumen (di-resolve engine); pembulatan sesuai `rounding_mode` versi
 * (`per_line` atau `per_document` dengan sisa pada baris terbesar) ke minor unit mata uang dokumen. Pajak
 * `withholding` ditulis ke `withholding_amount` dan TIDAK ke `tax_amount`, sehingga tidak menambah total dokumen
 * (Requirement 12.4). Baris tanpa pajak: dpp, pajak, dan potongan 0.
 *
 * Tidak mengenal model dokumen: pemanggil menyerahkan item bergaya model (atribut `tax_id`, `basic_amount`).
 */
final class InvoiceItemTaxCalculator {
    private const AMOUNT_PRECISION = 6;

    public function __construct(private readonly TaxEngine $engine) {}

    /**
     * @param  Collection<int, Model>  $items  item yang sudah tersimpan (punya `basic_amount` dan kunci)
     * @param  array<int, float>  $discounts  diskon per baris terurut seperti `$items->values()` (`DocumentDiscountCalculator::invoiceItemDiscounts()`)
     * @param  bool  $hasAmountColumn  true untuk Purchase Invoice (kolom `amount` = bersih + pajak penambah)
     * @return array{net: float, dpp: float, tax: float, withholding: float} total dokumen: Σ basis bersih, Σ dpp, Σ pajak penambah, Σ pajak potong
     */
    public function apply(Collection $items, array $discounts, CarbonInterface $date, int $minorUnit, bool $hasAmountColumn): array {
        $items = $items->values();

        $inputs = [];
        foreach ($items as $index => $item) {
            if (blank($item->tax_id)) {
                continue;
            }

            $net      = (float) $item->basic_amount - ($discounts[$index] ?? 0.0);
            $inputs[] = new TaxInput((string) $item->tax_id, $net, $date, $minorUnit, (string) $item->getKey());
        }

        $components = [];
        if ($inputs !== []) {
            foreach ($this->engine->calculateDocument($inputs)->components as $component) {
                $components[(string) $component->lineRef] = $component;
            }
        }

        $totals = ['net' => 0.0, 'dpp' => 0.0, 'tax' => 0.0, 'withholding' => 0.0];
        foreach ($items as $index => $item) {
            $discount  = $discounts[$index] ?? 0.0;
            $net       = (float) $item->basic_amount - $discount;
            $component = $components[(string) $item->getKey()] ?? null;

            $dpp         = $component === null ? 0.0 : (float) $component->dppAmount;
            $computed    = $component === null ? 0.0 : (float) $component->taxAmount;
            $withheld    = $component !== null && $component->behavior === Tax::BEHAVIOR_WITHHOLDING;
            $taxAmount   = $withheld ? 0.0 : $computed;
            $withholding = $withheld ? $computed : 0.0;

            $attributes = [
                'discount_amount'    => $discount,
                'dpp_amount'         => $dpp,
                'tax_amount'         => $taxAmount,
                'withholding_amount' => $withholding,
            ];
            if ($hasAmountColumn) {
                $attributes['amount'] = round($net + $taxAmount, self::AMOUNT_PRECISION);
            }

            $item->markAmountsComputed()->forceFill($attributes)->save();

            $totals['net'] += $net;
            $totals['dpp'] += $dpp;
            $totals['tax'] += $taxAmount;
            $totals['withholding'] += $withholding;
        }

        return $totals;
    }
}
