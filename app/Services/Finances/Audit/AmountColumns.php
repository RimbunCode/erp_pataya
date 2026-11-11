<?php

namespace App\Services\Finances\Audit;

/**
 * Menormalkan kolom nominal pada contoh (sample) laporan audit menjadi `float`.
 *
 * Setelah `general_ledgers.debit`/`credit` menjadi `decimal(20,4)` (Finance Fase 1, Task 8.2/8.3), MySQL
 * mengembalikan kolom itu dan hasil `SUM`/`ABS(SUM)` sebagai string ("1000.0000"), sedangkan tipe `double` lama
 * mengembalikan float. Laporan (tabel konsol dan JSON) harus tetap berbentuk angka, jadi nilai dinormalkan di sini.
 * Pembulatan 4 desimal sama dengan skala kolom, sehingga tidak mengubah nilai.
 */
final class AmountColumns {
    private const NAMES = ['debit', 'credit', 'sum_debit', 'sum_credit', 'diff'];

    private function __construct() {}

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function normalize(array $row): array {
        foreach (self::NAMES as $name) {
            if (isset($row[$name]) && is_numeric($row[$name])) {
                $row[$name] = round((float) $row[$name], 4);
            }
        }

        return $row;
    }
}
