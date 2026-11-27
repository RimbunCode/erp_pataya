<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.1 bagian B (Requirement 13.2): akun `stock` per baris yang benar-benar dipakai engine
 * ditulis balik ke baris Purchase Receipt. Kolom bersifat catatan audit: nullable (dokumen lama tidak di-backfill,
 * draft mengosongkannya) dan FK `restrictOnDelete` agar akun yang pernah dipakai tidak bisa dihapus.
 *
 * Aman dijalankan ulang: kolom yang sudah ada dilewati; `down()` hanya menghapus bila kolomnya ada.
 */
return new class extends Migration
{
    private const string TABLE  = 'purchase_receipt_items';
    private const string COLUMN = 'posted_account_id';

    public function up(): void {
        if (Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            $table->foreignUlid(self::COLUMN)->nullable()->constrained('accounts')->restrictOnDelete();
        });
    }

    public function down(): void {
        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            $table->dropForeign([self::COLUMN]);
            $table->dropColumn(self::COLUMN);
        });
    }
};
