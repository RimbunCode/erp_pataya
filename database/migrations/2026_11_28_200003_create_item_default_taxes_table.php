<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pajak default per item master untuk penjualan dan pembelian (spek finance-multi-tax-per-item, Task 11.1;
 * Requirement 15.1).
 *
 * Satu baris per (item, modul, pajak): `module` = `sales` | `purchase`, `position` = urutan pilihan (0 = Pajak
 * Utama). Default ada di level `items` induk, bukan varian. Pivot ini tidak punya `id` (kunci alami unik per item +
 * modul + pajak) karena ditulis lewat `sync()`/`attach()` yang memakai insert langsung. Hapus item menghapus barisnya
 * (cascade); pajak dihapus lunak tetap tersimpan sebagai referensi rusak yang dilewati resolver (Requirement 15.7).
 *
 * Aditif; `down()` menghapus tabel (default hilang, item tidak berubah).
 */
return new class extends Migration
{
    public function up(): void {
        Schema::create('item_default_taxes', function (Blueprint $table) {
            $table->foreignUlid('item_id')->constrained('items', 'id', 'item_default_taxes_item_fk')->cascadeOnDelete();
            $table->foreignUlid('tax_id')->constrained('taxes', 'id', 'item_default_taxes_tax_fk');
            $table->string('module', 16);
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['item_id', 'module', 'tax_id'], 'item_default_taxes_unique');
            $table->index('tax_id', 'item_default_taxes_tax_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('item_default_taxes');
    }
};
