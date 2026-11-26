<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.1 bagian B (Requirement 13.2): akun yang benar-benar dipakai engine ditulis balik ke baris
 * Delivery Note, dua kolom (keputusan pemilik produk, 26 Nov 2026): `posted_account_id` untuk akun
 * `cost_of_goods_sold` dan `posted_stock_account_id` untuk akun `stock`. Kolom bersifat catatan audit: nullable (dokumen
 * lama tidak di-backfill, draft mengosongkannya) dan FK `restrictOnDelete` agar akun yang pernah dipakai tidak bisa
 * dihapus.
 *
 * Aman dijalankan ulang: kolom yang sudah ada dilewati; `down()` hanya menghapus kolom yang ada.
 */
return new class extends Migration
{
    private const string TABLE  = 'delivery_note_items';
    private const array COLUMNS = ['posted_account_id', 'posted_stock_account_id'];

    public function up(): void {
        foreach (self::COLUMNS as $column) {
            if (Schema::hasColumn(self::TABLE, $column)) {
                continue;
            }

            Schema::table(self::TABLE, function (Blueprint $table) use ($column) {
                $table->foreignUlid($column)->nullable()->constrained('accounts')->restrictOnDelete();
            });
        }
    }

    public function down(): void {
        foreach (self::COLUMNS as $column) {
            if (! Schema::hasColumn(self::TABLE, $column)) {
                continue;
            }

            Schema::table(self::TABLE, function (Blueprint $table) use ($column) {
                $table->dropForeign([$column]);
                $table->dropColumn($column);
            });
        }
    }
};
