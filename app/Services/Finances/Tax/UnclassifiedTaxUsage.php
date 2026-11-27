<?php

namespace App\Services\Finances\Tax;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Pemakaian sebuah pajak pada invoice penjualan dan pembelian sejak tanggal tertentu (Finance Fase 3, Requirement
 * 1.3): dasar peringatan "pajak belum diklasifikasi tetapi sudah dipakai transaksi 12 bulan terakhir" di halaman
 * master Pajak. Hanya invoice (bukan SO/PO/penawaran) yang dihitung; baris dan invoice terhapus lunak tidak ikut,
 * begitu juga invoice draf dan dibatalkan (hanya invoice aktif; keputusan pemilik produk 27 November 2026).
 * Hitungan global, tidak dibatasi cabang.
 * Memakai query builder agar tidak mengimpor model modul bisnis (P-9).
 */
final class UnclassifiedTaxUsage {
    /** Jendela peringatan dalam bulan (Requirement 1.3). */
    public const WINDOW_MONTHS = 12;

    /**
     * @return array{sales_invoices: int, purchase_invoices: int}
     */
    public function invoiceCounts(string $taxId, CarbonInterface $now): array {
        $since = $now->copy()->subMonths(self::WINDOW_MONTHS);

        return [
            'sales_invoices'    => $this->count('sales_invoice_items', 'sales_invoices', 'sales_invoice_id', $taxId, $since),
            'purchase_invoices' => $this->count('purchase_invoice_items', 'purchase_invoices', 'purchase_invoice_id', $taxId, $since),
        ];
    }

    private function count(string $itemTable, string $headerTable, string $foreignKey, string $taxId, CarbonInterface $since): int {
        return DB::table($itemTable)
            ->join($headerTable, "{$headerTable}.id", '=', "{$itemTable}.{$foreignKey}")
            ->where("{$itemTable}.tax_id", $taxId)
            ->whereNull("{$itemTable}.deleted_at")
            ->whereNull("{$headerTable}.deleted_at")
            ->whereJsonDoesntContain("{$headerTable}.status", 'draft')
            ->whereJsonDoesntContain("{$headerTable}.status", 'canceled')
            ->where("{$headerTable}.date", '>=', $since->toDateString())
            ->distinct()
            ->count("{$headerTable}.id");
    }
}
