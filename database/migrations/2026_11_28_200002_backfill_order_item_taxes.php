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
 * Idempoten: item yang sudah punya baris pivot dilewati. Setiap tabel dikerjakan dalam SATU transaksi dengan dua
 * pemeriksaan:
 *  1. Konsistensi: item yang pajaknya `behavior = withholding` tetapi `tax_amount`-nya tidak nol (order lama
 *     menjumlahkan pajak potong ke total sebagai pajak tambah) TIDAK dinormalisasi diam-diam; migrasi berhenti dengan
 *     pesan yang mendaftar dokumen bermasalah, sebelum ada baris yang ditulis (jalur aman: menormalisasi akan
 *     mengubah total dokumen lama, bertentangan dengan Requirement 14.10). Query dry-run, hasil harus kosong:
 *     `SELECT i.<kolom_dokumen>, i.id FROM <tabel_item> i JOIN taxes t ON t.id = i.tax_id
 *      WHERE t.behavior = 'withholding' AND i.tax_amount <> 0` dengan kolom dokumen `quotation_id`/`sales_order_id`/
 *     `purchase_order_id` pada `quotation_items`/`sales_order_items`/`purchase_order_items`.
 *  2. Paritas PER DOKUMEN (bukan global): untuk tiap dokumen, Σ `tax_amount` pivot sama dengan Σ `tax_amount` item
 *     ber-`tax_id` dokumen itu yang punya pivot (toleransi 0,01); bila tidak, transaksi dibatalkan dengan daftar
 *     dokumen. Hanya DML, jalan di SQLite dan MySQL 8.
 *
 * `down()` HANYA mengosongkan baris pivot (bukan drop tabel), kolom item tidak berubah.
 */
return new class extends Migration
{
    private const PARITY_TOLERANCE = 0.01;
    private const CHUNK            = 500;

    /** @var array<string, array{pivot: string, foreignKey: string, documentKey: string}> tabel item => pivot */
    private const TABLES = [
        'quotation_items'      => ['pivot' => 'quotation_item_taxes', 'foreignKey' => 'quotation_item_id', 'documentKey' => 'quotation_id'],
        'sales_order_items'    => ['pivot' => 'sales_order_item_taxes', 'foreignKey' => 'sales_order_item_id', 'documentKey' => 'sales_order_id'],
        'purchase_order_items' => ['pivot' => 'purchase_order_item_taxes', 'foreignKey' => 'purchase_order_item_id', 'documentKey' => 'purchase_order_id'],
    ];

    public function up(): void {
        foreach (self::TABLES as $itemTable => $config) {
            if (! Schema::hasTable($config['pivot'])) {
                continue;
            }

            DB::transaction(function () use ($itemTable, $config): void {
                $this->assertWithholdingConsistent($itemTable, $config['pivot'], $config['foreignKey'], $config['documentKey']);
                $this->backfill($itemTable, $config['pivot'], $config['foreignKey']);
                $this->assertParity($itemTable, $config['pivot'], $config['foreignKey'], $config['documentKey']);
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

                DB::table($pivot)->insert($rows);
            });
    }

    /**
     * Pra-pemeriksaan konsistensi: pajak potong (`behavior = withholding`) yang tersimpan di `tax_amount` item tidak
     * dinormalisasi; migrasi berhenti dan mendaftar dokumennya.
     */
    private function assertWithholdingConsistent(string $itemTable, string $pivot, string $foreignKey, string $documentKey): void {
        $documents = DB::table($itemTable)
            ->join('taxes', 'taxes.id', '=', "{$itemTable}.tax_id")
            ->where('taxes.behavior', 'withholding')
            ->where("{$itemTable}.tax_amount", '<>', 0)
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
            ->distinct()
            ->limit(50)
            ->pluck("{$itemTable}.{$documentKey}");

        if ($documents->isNotEmpty()) {
            throw new RuntimeException(
                "Backfill dihentikan pada {$itemTable}: ada item berpajak potong (behavior = withholding) yang jumlahnya tersimpan di tax_amount. "
                . 'Normalisasi otomatis akan mengubah total dokumen lama, jadi koreksi dokumen berikut lebih dulu (maks. 50 ditampilkan): '
                . $documents->implode(', ') . '. Tidak ada baris pivot yang ditulis.',
            );
        }
    }

    /**
     * Pra-pemeriksaan paritas PER DOKUMEN (Requirement 7.2): Σ `tax_amount` pivot sama dengan Σ item ber-`tax_id`
     * yang punya pivot, dihitung untuk tiap dokumen.
     */
    private function assertParity(string $itemTable, string $pivot, string $foreignKey, string $documentKey): void {
        $items = DB::table($itemTable)
            ->whereNotNull('tax_id')
            ->whereExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
            ->groupBy($documentKey)
            ->selectRaw("{$documentKey} as document_id, SUM(tax_amount) as total")
            ->pluck('total', 'document_id');
        $pivots = DB::table($pivot)
            ->join($itemTable, "{$itemTable}.id", '=', "{$pivot}.{$foreignKey}")
            ->groupBy("{$itemTable}.{$documentKey}")
            ->selectRaw("{$itemTable}.{$documentKey} as document_id, SUM({$pivot}.tax_amount) as total")
            ->pluck('total', 'document_id');

        $mismatched = [];
        foreach ($items->keys()->merge($pivots->keys())->unique() as $documentId) {
            if (abs((float) ($items[$documentId] ?? 0) - (float) ($pivots[$documentId] ?? 0)) > self::PARITY_TOLERANCE) {
                $mismatched[] = $documentId;
            }
        }

        if ($mismatched !== []) {
            throw new RuntimeException(
                "Pra-pemeriksaan paritas gagal pada {$itemTable}: jumlah tax_amount item berbeda dari pivot (selisih lebih dari "
                . self::PARITY_TOLERANCE . ') pada dokumen: ' . implode(', ', \array_slice($mismatched, 0, 50))
                . '. Backfill dibatalkan dan tidak ada baris pivot yang tersisa; periksa item yang pajaknya tidak konsisten, lalu jalankan ulang.',
            );
        }
    }
};
