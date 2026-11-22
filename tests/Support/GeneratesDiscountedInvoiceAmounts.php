<?php

namespace Tests\Support;

use App\Services\Finances\DocumentDiscountCalculator;
use App\Services\Finances\Posting\Contexts\LineAttributes;

/**
 * Pembangkit dokumen invoice acak berseed tetap untuk uji posting diskon terpisah (Finance Fase 2, P-13). Alokasi diskon
 * memakai `DocumentDiscountCalculator::allocate()` seperti invoice sungguhan: basis `net_total`/`grand_total`/tanpa
 * diskon, tarif pajak 0/11/12, DPP berfaktor 11/12. Pajak tidak dibulatkan (kolom generated double), sehingga jumlah
 * baris bernilai pecahan banyak digit: keadaan terburuk untuk keseimbangan setelah pembulatan.
 *
 * `isStockItem` `null` (varian `$withUnknownStock`) diperlakukan Purchase Invoice seperti baris stok: tetap bersih.
 *
 * Pemanggil wajib memanggil `mt_srand()` (tanpa argumen) di `tearDown()` agar seed tetap tidak bocor ke tes lain.
 */
trait GeneratesDiscountedInvoiceAmounts {
    /**
     * @return array{0: list<LineAttributes>, 1: array{total: float, gross_amount: float, discount_amount: float, non_stock_gross: float, non_stock_discount: float}}
     */
    protected function discountedDocument(int $seed, bool $allStock = false, bool $withUnknownStock = false): array {
        mt_srand($seed);

        $count    = mt_rand(1, 6);
        $rawLines = [];
        for ($i = 0; $i < $count; $i++) {
            $rawLines[] = [
                'basic_amount' => round(mt_rand(1000, 5_000_000) / 7, 2),
                'tax_rate'     => [0, 11, 12][mt_rand(0, 2)],
            ];
        }

        $discountOn = [null, DocumentDiscountCalculator::BASIS_NET_TOTAL, DocumentDiscountCalculator::BASIS_GRAND_TOTAL][mt_rand(0, 2)];
        $sumBasic   = array_sum(array_column($rawLines, 'basic_amount'));
        $rate       = mt_rand(0, 40);

        $allocated = DocumentDiscountCalculator::allocate(
            $rawLines,
            $discountOn,
            (float) $rate,
            round($sumBasic * $rate / 100, 2),
            'discount_amount',
            11 / 12,
        );

        $lines  = [];
        $totals = ['total' => 0.0, 'gross_amount' => 0.0, 'discount_amount' => 0.0, 'non_stock_gross' => 0.0, 'non_stock_discount' => 0.0];
        foreach ($rawLines as $i => $raw) {
            $discount  = round($raw['basic_amount'] - $allocated[$i]['basic_amount'], 2);
            $tax       = (float) $allocated[$i]['tax_amount'];
            $net       = $raw['basic_amount'] - $discount + $tax;
            $grossLine = $raw['basic_amount'] + $tax;
            // `$withUnknownStock`: sebagian baris tanpa atribut stok (`null`, mis. baris aset); jalur bawaan tidak berubah
            // agar seed tes lama tetap menghasilkan dokumen yang sama.
            $isStock = $allStock ? true : ($withUnknownStock ? [true, false, null][mt_rand(0, 2)] : (bool) mt_rand(0, 1));

            $lines[] = new LineAttributes(
                ['amount' => $net, 'gross_amount' => $grossLine, 'discount_amount' => $discount],
                isStockItem: $isStock,
            );
            $totals['total'] += $net;
            $totals['gross_amount'] += $grossLine;
            $totals['discount_amount'] += $discount;
            if ($isStock === false) {
                $totals['non_stock_gross'] += $grossLine;
                $totals['non_stock_discount'] += $discount;
            }
        }

        return [$lines, $totals];
    }
}
