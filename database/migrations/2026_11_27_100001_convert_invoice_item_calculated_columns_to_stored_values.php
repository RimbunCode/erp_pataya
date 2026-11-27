<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 3, Bagian B (Task 9.2, Requirement 12.2 dan 12.5; D-15 disetujui pemilik produk 2026-11-15).
 *
 * Mengonversi `dpp_amount`, `tax_amount` (Sales dan Purchase Invoice) dan `amount` (Purchase Invoice) pada
 * `sales_invoice_items`/`purchase_invoice_items` dari kolom *stored generated* (faktor 11/12 tetap) menjadi kolom biasa
 * bertipe sama (`double`) yang diisi `TaxEngine` oleh service invoice. Kolom baru `withholding_amount` (default 0)
 * menyimpan pajak berperilaku `withholding` yang tidak menambah total dokumen (Requirement 12.4). Dokumen order
 * (`sales_order_items`, `purchase_order_items`) TIDAK disentuh (Requirement 12.7).
 *
 * Urutan langkah (setiap langkah sebelum "lepas generated" aditif dan aman diulang):
 *   1. Tambah `*_v2` (default 0) dan `withholding_amount`; lewati kolom yang sudah ada (aman dijalankan ulang bila
 *      migrasi terhenti di tengah).
 *   2. Salin nilai generated ke `*_v2`.
 *   3. PRA-PEMERIKSAAN PARITAS: jumlah baris dengan selisih salinan lebih dari 0,01 (1 minor unit pada 2 desimal) atau
 *      nilai NULL harus nol; bila tidak, migrasi berhenti dengan pesan jelas SEBELUM kolom lama dilepas.
 *   4. Hapus VIEW laporan yang merujuk tabel item (`report_sales_invoices`, `report_purchase_invoices`; audit Task 9.1:
 *      keduanya hanya membaca kolom header dan `COUNT(*)` item, bukan kolom yang dikonversi, tetapi SQLite menolak
 *      membangun ulang tabel selama view merujuknya).
 *   5. Lepas kolom generated menurut urutan dependensi (`amount` -> `tax_amount` -> `dpp_amount`), ganti nama `*_v2`.
 *   6. Buat ulang view dengan definisi migrasi aslinya.
 *   7. Aktifkan `finance_settings.tax_engine_calc_enabled` (mencabut guard faktor 11/12 di `TaxRuleVersionService`).
 *
 * JENDELA PEMELIHARAAN (MySQL 8): langkah 5 membangun ulang tabel besar dan DDL MySQL tidak transaksional. Jalankan
 * saat tidak ada penulisan invoice (matikan queue worker dan akses tulis invoice), ambil backup lebih dulu, dan
 * perkirakan waktu proporsional jumlah baris item. Bila migrasi gagal SETELAH langkah 1-3 tetapi sebelum langkah 5,
 * kolom `*_v2`/`withholding_amount` tersisa: jalankan ulang `migrate` (langkah 1 melewati kolom yang ada) atau hapus
 * kolom itu secara manual. Bila gagal di tengah langkah 5, `down()` TIDAK otomatis berjalan (MySQL sudah commit
 * implisit); periksa skema tabel, selesaikan langkah yang tersisa manual (lepas generated yang tersisa, ganti nama
 * `*_v2`), lalu catat migrasi sebagai selesai.
 *
 * RUNBOOK DEPLOY (M-7, keputusan 28 November 2026):
 *   a. KODE DAN MIGRASI SATU JENDELA. Kode baru menulis `dpp_amount`/`tax_amount`/`amount` secara eksplisit; bila
 *      kode itu berjalan sebelum migrasi, MySQL menolak penulisan ke kolom generated (error 3105) dan invoice gagal
 *      disimpan. Sebaliknya kode lama sesudah migrasi tidak lagi menghitung angka. Deploy kode lalu `migrate` tanpa
 *      jeda, dalam mode pemeliharaan (`php artisan down`).
 *   b. BARIS BARU ANTARA SALIN DAN DROP. Langkah 2 menyalin sekali; baris yang ditulis sesudahnya tidak ikut tersalin
 *      (`*_v2` = 0) dan pra-pemeriksaan paritas tidak melihatnya. Karena itu tidak boleh ada penulisan invoice
 *      (web, queue worker, scheduler) selama migrasi berjalan.
 *   c. PEMULIHAN BILA GAGAL ANTARA DROP VIEW DAN BUAT ULANG VIEW (langkah 4 sampai 6): view laporan hilang. Setelah
 *      skema tabel selesai (lihat catatan jendela pemeliharaan), buat ulang view dengan menjalankan `up()` migrasi
 *      `2026_10_15_100400_create_report_sales_invoice_view.php` dan
 *      `2026_10_15_100500_create_report_purchase_invoice_view.php` (`(require $path)->up();` lewat tinker; migrasi itu
 *      sudah tercatat sehingga tidak dijalankan ulang oleh `migrate`), lalu `DROP VIEW IF EXISTS` dahulu bila sebagian
 *      sudah terbentuk.
 *   d. IZIN/PERAN BARU. Tidak ada izin pengguna baru. Peran akun `withholding_receivable` (penjualan) dan
 *      `withholding_payable` (pembelian) kini wajib dipetakan pada Posting Profile aktif sebelum menyetujui invoice
 *      yang memuat pajak potong (approve ditolak dengan pesan jelas bila belum). Peran ini tampil di peringatan halaman
 *      Posting Profile.
 *   e. SETELAH MIGRASI: pajak "tanpa pajak" hasil backfill yang masih berfaktor 11/12 tetap menampilkan kolom DPP
 *      di form; buat versi aturan berfaktor 1/1 untuknya (tab Versi Aturan) bila kolom DPP tidak diinginkan.
 *
 * `down()` mengembalikan kolom generated 11/12 (formula migrasi 2026-08-18). Nilai kolom biasa DIBUANG dan dihitung ulang
 * dari `basic_amount`, `discount_amount`, `tax_rate`, sehingga `down()` menolak berjalan bila ada baris yang nilai
 * tersimpannya menyimpang lebih dari 0,01 dari formula itu (baris tanpa `tax_id` dikecualikan: nilai tersimpannya 0 sesuai keputusan 28 November 2026, sedangkan kolom generated lama menghasilkan basis x 11/12 untuknya; pemulihan sengaja mengembalikan perilaku lama itu) atau memuat `withholding_amount` > 0 (dokumen berfaktor DPP
 * selain 11/12 atau berpajak potong tidak dapat dipulihkan tanpa mengubah angka).
 */
return new class extends Migration
{
    private const PARITY_TOLERANCE = 0.01;

    /** @var array<string, list<string>> tabel => kolom generated menurut urutan pembuatan (dependensi: terakhir paling bergantung) */
    private const TABLES = [
        'sales_invoice_items'    => ['dpp_amount', 'tax_amount'],
        'purchase_invoice_items' => ['dpp_amount', 'tax_amount', 'amount'],
    ];

    /** @var array<string, string> tabel => migrasi pembuat view laporan yang merujuk tabel itu */
    private const VIEW_MIGRATIONS = [
        'report_sales_invoices'    => '2026_10_15_100400_create_report_sales_invoice_view.php',
        'report_purchase_invoices' => '2026_10_15_100500_create_report_purchase_invoice_view.php',
    ];

    public function up(): void {
        foreach (self::TABLES as $table => $columns) {
            $this->addStoredColumns($table, $columns);
            $this->copyGeneratedValues($table, $columns);
            $this->assertParity($table, $columns);
        }

        $this->dropViews();

        foreach (self::TABLES as $table => $columns) {
            $this->replaceGeneratedColumns($table, $columns);
        }

        $this->createViews();
        $this->setCalcEnabled(true);
    }

    public function down(): void {
        foreach (self::TABLES as $table => $columns) {
            $this->assertRestorable($table, $columns);
        }

        $this->dropViews();

        foreach (self::TABLES as $table => $columns) {
            $this->restoreGeneratedColumns($table, $columns);
        }

        $this->createViews();
        $this->setCalcEnabled(false);
    }

    /**
     * @param  list<string>  $columns
     */
    private function addStoredColumns(string $table, array $columns): void {
        foreach ($columns as $column) {
            if (Schema::hasColumn($table, $column . '_v2')) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->double($column . '_v2')->default(0);
            });
        }

        if (! Schema::hasColumn($table, 'withholding_amount')) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->double('withholding_amount')->default(0);
            });
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function copyGeneratedValues(string $table, array $columns): void {
        $assignments = array_map(fn (string $column): string => "{$column}_v2 = {$column}", $columns);

        DB::statement("UPDATE {$table} SET " . implode(', ', $assignments));
    }

    /**
     * Pra-pemeriksaan paritas (Requirement 12.5): salinan harus sama dengan nilai generated; hasil bukan nol
     * menghentikan migrasi sebelum kolom lama dilepas.
     *
     * @param  list<string>  $columns
     */
    private function assertParity(string $table, array $columns): void {
        $conditions = [];
        foreach ($columns as $column) {
            $conditions[] = "{$column}_v2 IS NULL OR ABS({$column}_v2 - {$column}) > " . self::PARITY_TOLERANCE;
        }

        $mismatched = (int) DB::table($table)->whereRaw('(' . implode(') OR (', $conditions) . ')')->count();
        if ($mismatched > 0) {
            throw new RuntimeException(
                "Pra-pemeriksaan paritas gagal: {$mismatched} baris {$table} memiliki salinan kolom hitung yang berbeda lebih dari "
                . self::PARITY_TOLERANCE . ' dari nilai generated. Kolom lama TIDAK dilepas dan data tidak berubah. '
                . 'Periksa baris itu, lalu jalankan ulang migrasi (kolom *_v2 yang sudah ada akan dipakai ulang).',
            );
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function replaceGeneratedColumns(string $table, array $columns): void {
        // Lepas dari kolom yang paling bergantung dulu (`amount` -> `tax_amount` -> `dpp_amount`); SQLite membangun
        // ulang tabel per panggilan Schema::table() dan gagal bila generated column lain masih merujuk kolom itu.
        foreach (array_reverse($columns) as $column) {
            Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->dropColumn($column);
            });
        }

        foreach ($columns as $column) {
            Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->renameColumn($column . '_v2', $column);
            });
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function assertRestorable(string $table, array $columns): void {
        $withholding = (int) DB::table($table)->where('withholding_amount', '>', 0)->count();
        if ($withholding > 0) {
            throw new RuntimeException("down() ditolak: {$withholding} baris {$table} memuat withholding_amount > 0 yang tidak dapat direpresentasikan kolom generated.");
        }

        $expected = [
            'dpp_amount' => '(basic_amount - discount_amount) * 11 / 12',
            'tax_amount' => 'dpp_amount * tax_rate / 100',
            'amount'     => '(basic_amount - discount_amount) + tax_amount',
        ];

        $conditions = [];
        foreach ($columns as $column) {
            $conditions[] = "ABS({$column} - ({$expected[$column]})) > " . self::PARITY_TOLERANCE;
        }

        $drifted = (int) DB::table($table)->whereNotNull('tax_id')->whereRaw('(' . implode(') OR (', $conditions) . ')')->count();
        if ($drifted > 0) {
            throw new RuntimeException(
                "down() ditolak: {$drifted} baris {$table} memiliki dpp/pajak/jumlah yang tidak sama dengan formula 11/12 lama "
                . '(faktor DPP versi aturan selain 11/12, atau pembulatan engine). Mengembalikan kolom generated akan mengubah angka dokumen.',
            );
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function restoreGeneratedColumns(string $table, array $columns): void {
        foreach (array_reverse($columns) as $column) {
            Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->dropColumn($column);
            });
        }

        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->dropColumn('withholding_amount');
        });

        foreach ($columns as $column) {
            Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->double($column)->storedAs(match ($column) {
                    'dpp_amount' => '(basic_amount - discount_amount) * 11 / 12',
                    'tax_amount' => 'dpp_amount * tax_rate / 100',
                    default      => '(basic_amount - discount_amount) + tax_amount',
                });
            });
        }
    }

    private function dropViews(): void {
        foreach (array_keys(self::VIEW_MIGRATIONS) as $view) {
            DB::statement("DROP VIEW IF EXISTS {$view}");
        }
    }

    /**
     * Membuat ulang view dengan menjalankan `up()` migrasi aslinya (satu sumber definisi, tanpa salinan SQL).
     */
    private function createViews(): void {
        foreach (self::VIEW_MIGRATIONS as $file) {
            $migration = require __DIR__ . '/' . $file;
            $migration->up();
        }
    }

    private function setCalcEnabled(bool $enabled): void {
        if (Schema::hasTable('finance_settings') && Schema::hasColumn('finance_settings', 'tax_engine_calc_enabled')) {
            DB::table('finance_settings')->update(['tax_engine_calc_enabled' => $enabled]);
        }
    }
};
