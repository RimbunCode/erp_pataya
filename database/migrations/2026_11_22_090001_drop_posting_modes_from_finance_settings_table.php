<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Q-P2-23 (keputusan pemilik produk 2026-11-22, opsi A): mode engine `off`/`shadow` dihapus dan engine
 * selalu aktif, sehingga setting `finance_settings.posting_modes` (ditambahkan 2026_11_12_100005) tidak punya arti lagi
 * dan dihapus. Produksi belum berisi data dan staging hanya data uji, jadi tidak ada nilai yang perlu dipindahkan.
 *
 * Aman dijalankan ulang: tabel atau kolom yang sudah tidak ada dilewati. Sengaja tidak menyentuh tabel
 * `posting_parity_logs` (riwayat dipertahankan) maupun kolom `posting_executions` (D-1).
 *
 * `down()` mengembalikan kolom nullable dan, bila baris setting sudah ada, mengisinya dengan `on` untuk seluruh jenis
 * dokumen: rilis sebelumnya membaca nilai kosong sebagai `off` dan gagal tertutup, jadi rollback harus memulihkan `on`
 * agar posting tetap berfungsi. Batasan yang diketahui: bila belum ada baris setting, rilis sebelumnya membuat baris
 * bawaan dengan semua jenis `off`; ubah ke `on` lewat izin `switch_posting_mode` setelah rollback.
 */
return new class extends Migration
{
    /** Jenis dokumen ditulis literal agar migrasi tidak bergantung pada enum yang dapat berubah. */
    private const array DOCUMENT_TYPES = [
        'sales_invoice', 'purchase_invoice', 'purchase_receipt', 'delivery_note', 'payment_entry',
        'stock_entry', 'asset_depreciation', 'asset_scrap', 'asset_value_adjustment', 'asset_disposal',
    ];

    public function up(): void {
        if (! Schema::hasTable('finance_settings') || ! Schema::hasColumn('finance_settings', 'posting_modes')) {
            return;
        }

        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn('posting_modes');
        });
    }

    public function down(): void {
        if (! Schema::hasTable('finance_settings') || Schema::hasColumn('finance_settings', 'posting_modes')) {
            return;
        }

        Schema::table('finance_settings', function (Blueprint $table) {
            $table->json('posting_modes')->nullable();
        });

        DB::table('finance_settings')->update([
            'posting_modes' => json_encode(array_fill_keys(self::DOCUMENT_TYPES, 'on')),
        ]);
    }
};
