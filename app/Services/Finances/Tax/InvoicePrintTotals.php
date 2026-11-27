<?php

namespace App\Services\Finances\Tax;

use Illuminate\Support\Collection;

/**
 * Angka pajak tambahan untuk cetak invoice (Finance Fase 3, Bagian B, Task 9 putaran perbaikan I-2).
 *
 * - `withholding`: jumlah pajak potong semua baris (`withholding_amount`), tampil sebagai "Pajak Dipotong" supaya
 *   Grand Total (`amount`, sudah dikurangi potongan) cocok dengan baris di atasnya.
 * - `dpp`: DPP hanya dari baris pajak PENAMBAH yang faktor versi aturannya bukan 1/1 (mis. PPN 11/12); null bila tidak
 *   ada baris seperti itu, sehingga DPP tidak tampil dan basis pajak potong (PPh) tidak tercampur dengan DPP PPN.
 *
 * Tidak mengenal model dokumen: menerima item yang sudah dimuat (`tax_rule_version_id`, `dpp_amount`,
 * `withholding_amount`).
 */
final class InvoicePrintTotals {
    public function __construct(private readonly TaxRuleResolver $resolver) {}

    /**
     * @param  Collection<int, object>  $items
     */
    public function withholding(Collection $items): float {
        return round((float) $items->sum('withholding_amount'), 6);
    }

    /**
     * @param  Collection<int, object>  $items
     */
    public function dpp(Collection $items): ?float {
        $total = 0.0;
        $found = false;

        foreach ($items as $item) {
            $versionId = $item->tax_rule_version_id ?? null;
            if (blank($versionId) || (float) ($item->withholding_amount ?? 0) > 0) {
                continue;
            }

            $version = $this->resolver->findVersion((string) $versionId);
            if ($version === null || (int) $version->dpp_numerator === (int) $version->dpp_denominator) {
                continue;
            }

            $found = true;
            $total += (float) $item->dpp_amount;
        }

        return $found ? round($total, 6) : null;
    }
}
