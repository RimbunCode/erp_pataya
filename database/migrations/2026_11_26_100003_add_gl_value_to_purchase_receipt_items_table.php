<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.1 bagian B (keputusan pemilik produk, 26 Nov 2026): nilai GL per baris Purchase Receipt
 * disimpan saat approve, supaya retry posting menghasilkan nilai yang sama persis dengan posting asli (retur di luar
 * PO dan ALUR-2 dengan rate invoice tidak bisa dihitung ulang dari rate PO Item). Kolom nullable: dokumen yang
 * diposting sebelum perbaikan ini tidak di-backfill, dan baris tanpa nilai GL tetap null. Tipe `double` mengikuti
 * kolom nilai lain di proyek.
 *
 * Aman dijalankan ulang: kolom yang sudah ada dilewati; `down()` hanya menghapus bila kolomnya ada.
 */
return new class extends Migration
{
    private const string TABLE  = 'purchase_receipt_items';
    private const string COLUMN = 'gl_value';

    public function up(): void {
        if (Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            $table->double(self::COLUMN)->nullable();
        });
    }

    public function down(): void {
        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            $table->dropColumn(self::COLUMN);
        });
    }
};
