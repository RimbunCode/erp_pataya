<?php

namespace App\Services\Finances\Tax;

use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder as QueryBuilder;
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
            'sales_invoices'    => $this->count('sales_invoice_items', 'sales_invoice_item_taxes', 'sales_invoice_item_id', 'sales_invoices', 'sales_invoice_id', $taxId, $since),
            'purchase_invoices' => $this->count('purchase_invoice_items', 'purchase_invoice_item_taxes', 'purchase_invoice_item_id', 'purchase_invoices', 'purchase_invoice_id', $taxId, $since),
        ];
    }

    /**
     * Invoice yang memakai pajak itu pada SALAH SATU baris pajak itemnya (pivot, termasuk pajak non-utama; pajak
     * majemuk per item). Item tanpa baris pivot (sebelum backfill) dihitung lewat kolom `tax_id` item.
     */
    private function count(string $itemTable, string $pivotTable, string $pivotKey, string $headerTable, string $foreignKey, string $taxId, CarbonInterface $since): int {
        $base = fn (QueryBuilder $query): QueryBuilder => $query
            ->join($headerTable, "{$headerTable}.id", '=', "{$itemTable}.{$foreignKey}")
            ->whereNull("{$itemTable}.deleted_at")
            ->whereNull("{$headerTable}.deleted_at")
            ->whereJsonDoesntContain("{$headerTable}.status", 'draft')
            ->whereJsonDoesntContain("{$headerTable}.status", 'canceled')
            ->where("{$headerTable}.date", '>=', $since->toDateString());

        $viaPivot = $base(DB::table($itemTable))
            ->join($pivotTable, "{$pivotTable}.{$pivotKey}", '=', "{$itemTable}.id")
            ->where("{$pivotTable}.tax_id", $taxId)
            ->select("{$headerTable}.id");

        $legacy = $base(DB::table($itemTable))
            ->where("{$itemTable}.tax_id", $taxId)
            ->whereNotExists(fn (QueryBuilder $query) => $query->selectRaw('1')->from($pivotTable)->whereColumn("{$pivotTable}.{$pivotKey}", "{$itemTable}.id"))
            ->select("{$headerTable}.id");

        return DB::query()->fromSub($viaPivot->union($legacy), 'usage')->count();
    }
}
