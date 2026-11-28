<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Backfill pajak majemuk per item invoice (spek finance-multi-tax-per-item, Task 2.3; Requirement 7.1-7.4).
 *
 * Untuk setiap item `sales_invoice_items`/`purchase_invoice_items` yang `tax_id`-nya terisi dan BELUM punya baris
 * pivot sama sekali, dibuat satu baris pivot: `position` 0, `tax_rule_version_id`/`tax_rate`/`dpp_amount` disalin dari
 * item, `base_amount` = `basic_amount - discount_amount`, `dpp_factor` dari versi aturan (11/12 bila item tanpa
 * versi, faktor legacy Bagian A), dan jumlah pajak menurut `taxes.behavior` (dibaca `withTrashed`): pajak
 * `withholding` mengisi `withholding_amount` (dan `tax_amount` 0), selain itu mengisi `tax_amount` (dan
 * `withholding_amount` 0). Item tanpa `tax_id` tidak dibuatkan baris (aturan "tanpa pajak").
 *
 * Idempoten: item yang sudah punya baris pivot dilewati, jadi aman dijalankan ulang. Setiap tabel dikerjakan dalam
 * SATU transaksi bersama pra-pemeriksaan paritas: jumlah `tax_amount` dan `withholding_amount` pivot harus sama dengan
 * jumlah item ber-`tax_id` yang punya pivot (toleransi 0,01); bila tidak, transaksi dibatalkan dengan pesan jelas dan tidak ada baris
 * yang tersisa. (MySQL: DDL tidak ada di sini, hanya DML sehingga transaksi efektif.) Dokumen yang sudah disetujui
 * tidak dihitung ulang dan kolom item tidak diubah.
 *
 * Memakai Schema builder dan chunk PHP (bukan SQL spesifik) agar jalan di SQLite (test) dan MySQL 8 (produksi).
 *
 * `down()` HANYA mengosongkan baris pivot (bukan drop tabel): tabel dimiliki migrasi pembuat, sehingga rollback satu
 * langkah tidak meninggalkan migrasi pembuat tercatat dengan tabel yang sudah hilang. Kolom item tidak diubah.
 */
return new class extends Migration
{
    private const PARITY_TOLERANCE = 0.01;
    private const CHUNK            = 500;

    /** Faktor DPP legacy Bagian A (11/12) untuk item tanpa versi aturan. */
    private const LEGACY_DPP_FACTOR = 11 / 12;

    /** @var array<string, array{pivot: string, foreignKey: string}> tabel item => pivot */
    private const TABLES = [
        'sales_invoice_items'    => ['pivot' => 'sales_invoice_item_taxes', 'foreignKey' => 'sales_invoice_item_id'],
        'purchase_invoice_items' => ['pivot' => 'purchase_invoice_item_taxes', 'foreignKey' => 'purchase_invoice_item_id'],
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
                $behaviors = DB::table('taxes')->whereIn('id', $items->pluck('tax_id')->unique()->all())->pluck('behavior', 'id');
                $versions  = DB::table('tax_rule_versions')
                    ->whereIn('id', $items->pluck('tax_rule_version_id')->filter()->unique()->all())
                    ->get(['id', 'dpp_numerator', 'dpp_denominator'])
                    ->keyBy('id');

                $rows = [];
                foreach ($items as $item) {
                    $version     = $item->tax_rule_version_id === null ? null : $versions->get($item->tax_rule_version_id);
                    $withholding = ($behaviors[$item->tax_id] ?? 'additive') === 'withholding';

                    $rows[] = [
                        'id'                  => (string) Str::ulid(),
                        $foreignKey           => $item->id,
                        'tax_id'              => $item->tax_id,
                        'tax_rule_version_id' => $version === null ? null : $item->tax_rule_version_id,
                        'position'            => 0,
                        'tax_rate'            => (float) $item->tax_rate,
                        'dpp_factor'          => $version === null ? self::LEGACY_DPP_FACTOR : (int) $version->dpp_numerator / max(1, (int) $version->dpp_denominator),
                        'base_amount'         => (float) $item->basic_amount - (float) $item->discount_amount,
                        'dpp_amount'          => (float) $item->dpp_amount,
                        'tax_amount'          => $withholding ? 0.0 : (float) $item->tax_amount,
                        'withholding_amount'  => $withholding ? (float) $item->withholding_amount : 0.0,
                        'created_at'          => $now,
                        'updated_at'          => $now,
                    ];
                }

                DB::table($pivot)->insertOrIgnore($rows);
            });
    }

    /**
     * Pra-pemeriksaan paritas (Requirement 7.2): jumlah semua baris pivot harus sama dengan jumlah item ber-`tax_id` yang punya pivot.
     */
    private function assertParity(string $itemTable, string $pivot, string $foreignKey): void {
        foreach (['tax_amount', 'withholding_amount'] as $column) {
            // Item yang punya pivot (agregat item = Σ semua pivot item itu, juga bila ada pajak majemuk sesudah backfill).
            $items = (float) DB::table($itemTable)
                ->whereNotNull('tax_id')
                ->whereExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
                ->sum($column);
            $pivots = (float) DB::table($pivot)->sum($column);

            if (abs($items - $pivots) > self::PARITY_TOLERANCE) {
                throw new RuntimeException(
                    "Pra-pemeriksaan paritas gagal pada {$itemTable}: jumlah {$column} item {$items} berbeda dari pivot {$pivots} "
                    . '(selisih lebih dari ' . self::PARITY_TOLERANCE . '). Backfill dibatalkan dan tidak ada baris pivot yang tersisa. '
                    . 'Periksa item yang pajaknya tidak konsisten dengan taxes.behavior (mis. pajak potong yang tersimpan sebagai tax_amount), lalu jalankan ulang.',
                );
            }
        }
    }
};
