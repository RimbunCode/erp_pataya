<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Backfill pajak majemuk per item Quotation, Sales Order, dan Purchase Order (spek finance-multi-tax-per-item,
 * Task 9.1; Requirement 14.1 dan 14.10).
 *
 * Untuk setiap item yang `tax_id`-nya terisi dan BELUM punya baris pivot, dibuat satu baris: `position` 0,
 * `tax_rule_version_id` null, `tax_rate` dan `tax_amount` disalin dari item, `base_amount` = `basic_amount -
 * discount_amount` (Quotation tidak punya diskon), `dpp_factor` 1 dan `dpp_amount` = basis (order lama dihitung
 * sederhana `basis x tarif / 100`, tanpa faktor DPP dan tanpa pajak potong), `withholding_amount` 0. Angka order lama
 * TIDAK dihitung ulang (Requirement 14.10): pivot hanya mencerminkan nilai tersimpan, perhitungan memakai `TaxEngine`
 * baru berlaku ketika dokumen disimpan ulang.
 *
 * Idempoten: item yang sudah punya baris pivot dilewati. Setiap tabel dikerjakan dalam SATU transaksi bersama
 * pra-pemeriksaan paritas: Σ `tax_amount` pivot harus sama dengan Σ `tax_amount` item ber-`tax_id` yang punya pivot
 * (toleransi 0,01); bila tidak, transaksi dibatalkan dengan pesan jelas. Hanya DML, jalan di SQLite dan MySQL 8.
 *
 * `down()` HANYA mengosongkan baris pivot (bukan drop tabel), kolom item tidak berubah.
 */
return new class extends Migration
{
    private const PARITY_TOLERANCE = 0.01;
    private const CHUNK            = 500;

    /** @var array<string, array{pivot: string, foreignKey: string}> tabel item => pivot */
    private const TABLES = [
        'quotation_items'      => ['pivot' => 'quotation_item_taxes', 'foreignKey' => 'quotation_item_id'],
        'sales_order_items'    => ['pivot' => 'sales_order_item_taxes', 'foreignKey' => 'sales_order_item_id'],
        'purchase_order_items' => ['pivot' => 'purchase_order_item_taxes', 'foreignKey' => 'purchase_order_item_id'],
    ];

    public function up(): void {
        foreach (self::TABLES as $itemTable => $config) {
            if (! Schema::hasTable($config['pivot'])) {
                continue;
            }

            DB::transaction(function () use ($itemTable, $config): void {
                $this->backfill($itemTable, $config['pivot'], $config['foreignKey']);
                $this->assertParity($itemTable, $config['pivot'], $config['foreignKey']);
            });
        }
    }

    public function down(): void {
        foreach (self::TABLES as $config) {
            if (Schema::hasTable($config['pivot'])) {
                DB::table($config['pivot'])->delete();
            }
        }
    }

    private function backfill(string $itemTable, string $pivot, string $foreignKey): void {
        $now = now();

        DB::table($itemTable)
            ->whereNotNull('tax_id')
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($items) use ($pivot, $foreignKey, $now): void {
                $rows = [];
                foreach ($items as $item) {
                    $base = (float) $item->basic_amount - (float) ($item->discount_amount ?? 0);

                    $rows[] = [
                        'id'                  => (string) Str::ulid(),
                        $foreignKey           => $item->id,
                        'tax_id'              => $item->tax_id,
                        'tax_rule_version_id' => null,
                        'position'            => 0,
                        'tax_rate'            => (float) $item->tax_rate,
                        'dpp_factor'          => 1,
                        'base_amount'         => $base,
                        'dpp_amount'          => $base,
                        'tax_amount'          => (float) $item->tax_amount,
                        'withholding_amount'  => 0,
                        'created_at'          => $now,
                        'updated_at'          => $now,
                    ];
                }

                DB::table($pivot)->insertOrIgnore($rows);
            });
    }

    /**
     * Pra-pemeriksaan paritas (Requirement 7.2): Σ `tax_amount` pivot sama dengan Σ item ber-`tax_id` yang punya pivot.
     */
    private function assertParity(string $itemTable, string $pivot, string $foreignKey): void {
        $items = (float) DB::table($itemTable)
            ->whereNotNull('tax_id')
            ->whereExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
            ->sum('tax_amount');
        $pivots = (float) DB::table($pivot)->sum('tax_amount');

        if (abs($items - $pivots) > self::PARITY_TOLERANCE) {
            throw new RuntimeException(
                "Pra-pemeriksaan paritas gagal pada {$itemTable}: jumlah tax_amount item {$items} berbeda dari pivot {$pivots} "
                . '(selisih lebih dari ' . self::PARITY_TOLERANCE . '). Backfill dibatalkan dan tidak ada baris pivot yang tersisa; '
                . 'periksa item yang pajaknya tidak konsisten, lalu jalankan ulang.',
            );
        }
    }
};
