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
 * `dpp_factor` legacy (11/12) HANYA untuk pajak berkategori PPN (`ppn_standard`/`ppn_luxury`) yang itemnya tanpa versi
 * aturan; pajak non-PPN (mis. PPh) tanpa versi diberi faktor 1 (basis penuh).
 *
 * Idempoten: item yang sudah punya baris pivot dilewati, jadi aman dijalankan ulang. Setiap tabel dikerjakan dalam
 * SATU transaksi dengan dua pemeriksaan:
 *  1. Pra-pemeriksaan konsistensi: item yang pajaknya `behavior = withholding` tetapi `tax_amount`-nya tidak nol
 *     (pajak potong tersimpan sebagai pajak tambah) TIDAK dinormalisasi diam-diam. Migrasi berhenti dengan pesan
 *     yang mendaftar dokumen bermasalah, sebelum ada baris yang ditulis; pemilik data memperbaiki dokumen itu lebih
 *     dulu (jalur aman, karena menormalisasi akan mengubah total dokumen yang sudah disetujui).
 *     Query dry-run (jalankan sebelum deploy, hasil harus kosong):
 *     `SELECT i.sales_invoice_id, i.id FROM sales_invoice_items i JOIN taxes t ON t.id = i.tax_id
 *      WHERE t.behavior = 'withholding' AND i.tax_amount <> 0` (idem `purchase_invoice_items`/`purchase_invoice_id`).
 *  2. Paritas PER DOKUMEN (bukan global): untuk tiap invoice, jumlah `tax_amount` dan `withholding_amount` pivot harus
 *     sama dengan jumlah item ber-`tax_id` dokumen itu yang punya pivot (toleransi 0,01), sehingga selisih yang saling
 *     meniadakan antar dokumen tidak lolos. Bila gagal, transaksi dibatalkan dengan daftar dokumen dan tidak ada baris
 *     yang tersisa. (MySQL: DDL tidak ada di sini, hanya DML sehingga transaksi efektif.) Dokumen yang sudah disetujui
 *     tidak dihitung ulang dan kolom item tidak diubah.
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

    /** Kategori pajak yang memakai faktor DPP legacy 11/12 saat item tidak punya versi aturan. */
    private const PPN_CATEGORIES = ['ppn_standard', 'ppn_luxury'];

    /** @var array<string, array{pivot: string, foreignKey: string, documentKey: string}> tabel item => pivot */
    private const TABLES = [
        'sales_invoice_items'    => ['pivot' => 'sales_invoice_item_taxes', 'foreignKey' => 'sales_invoice_item_id', 'documentKey' => 'sales_invoice_id'],
        'purchase_invoice_items' => ['pivot' => 'purchase_invoice_item_taxes', 'foreignKey' => 'purchase_invoice_item_id', 'documentKey' => 'purchase_invoice_id'],
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
                $taxes    = DB::table('taxes')->whereIn('id', $items->pluck('tax_id')->unique()->all())->get(['id', 'behavior', 'category'])->keyBy('id');
                $versions = DB::table('tax_rule_versions')
                    ->whereIn('id', $items->pluck('tax_rule_version_id')->filter()->unique()->all())
                    ->get(['id', 'dpp_numerator', 'dpp_denominator'])
                    ->keyBy('id');

                $rows = [];
                foreach ($items as $item) {
                    $version     = $item->tax_rule_version_id === null ? null : $versions->get($item->tax_rule_version_id);
                    $tax         = $taxes->get($item->tax_id);
                    $withholding = ($tax->behavior ?? 'additive') === 'withholding';
                    $legacyDpp   = \in_array($tax->category ?? null, self::PPN_CATEGORIES, true) ? self::LEGACY_DPP_FACTOR : 1;

                    $rows[] = [
                        'id'                  => (string) Str::ulid(),
                        $foreignKey           => $item->id,
                        'tax_id'              => $item->tax_id,
                        'tax_rule_version_id' => $version === null ? null : $item->tax_rule_version_id,
                        'position'            => 0,
                        'tax_rate'            => (float) $item->tax_rate,
                        'dpp_factor'          => $version === null ? $legacyDpp : (int) $version->dpp_numerator / max(1, (int) $version->dpp_denominator),
                        'base_amount'         => (float) $item->basic_amount - (float) $item->discount_amount,
                        'dpp_amount'          => (float) $item->dpp_amount,
                        'tax_amount'          => $withholding ? 0.0 : (float) $item->tax_amount,
                        'withholding_amount'  => $withholding ? (float) $item->withholding_amount : 0.0,
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
                . 'Normalisasi otomatis akan mengubah total dokumen yang sudah ada, jadi koreksi dokumen berikut lebih dulu (maks. 50 ditampilkan): '
                . $documents->implode(', ') . '. Tidak ada baris pivot yang ditulis.',
            );
        }
    }

    /**
     * Pra-pemeriksaan paritas PER DOKUMEN (Requirement 7.2): untuk tiap dokumen, jumlah baris pivot harus sama dengan
     * jumlah item ber-`tax_id` yang punya pivot.
     */
    private function assertParity(string $itemTable, string $pivot, string $foreignKey, string $documentKey): void {
        foreach (['tax_amount', 'withholding_amount'] as $column) {
            $items = DB::table($itemTable)
                ->whereNotNull('tax_id')
                ->whereExists(fn ($query) => $query->selectRaw('1')->from($pivot)->whereColumn("{$pivot}.{$foreignKey}", "{$itemTable}.id"))
                ->groupBy($documentKey)
                ->selectRaw("{$documentKey} as document_id, SUM({$column}) as total")
                ->pluck('total', 'document_id');
            $pivots = DB::table($pivot)
                ->join($itemTable, "{$itemTable}.id", '=', "{$pivot}.{$foreignKey}")
                ->groupBy("{$itemTable}.{$documentKey}")
                ->selectRaw("{$itemTable}.{$documentKey} as document_id, SUM({$pivot}.{$column}) as total")
                ->pluck('total', 'document_id');

            $mismatched = [];
            foreach ($items->keys()->merge($pivots->keys())->unique() as $documentId) {
                if (abs((float) ($items[$documentId] ?? 0) - (float) ($pivots[$documentId] ?? 0)) > self::PARITY_TOLERANCE) {
                    $mismatched[] = $documentId;
                }
            }

            if ($mismatched !== []) {
                throw new RuntimeException(
                    "Pra-pemeriksaan paritas gagal pada {$itemTable}: jumlah {$column} item berbeda dari pivot (selisih lebih dari "
                    . self::PARITY_TOLERANCE . ') pada dokumen: ' . implode(', ', \array_slice($mismatched, 0, 50))
                    . '. Backfill dibatalkan dan tidak ada baris pivot yang tersisa. Periksa item yang pajaknya tidak konsisten dengan taxes.behavior, lalu jalankan ulang.',
                );
            }
        }
    }
};
