<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aturan akun bersyarat (Finance Fase 2, Requirement 12.1): (jenis dokumen, varian, atribut barang) => akun untuk
     * satu peran. Kondisi null berarti tidak dibatasi.
     *
     * Indeks unik atas kombinasi kondisi hanya jaring pengaman: kolom nullable tidak dianggap sama oleh MySQL/SQLite
     * (NULL tidak sama dengan NULL), jadi penjaga duplikat yang sebenarnya ada di `PostingProfileService`. Nama
     * indeks dipendekkan eksplisit (batas identifier MySQL 64 karakter).
     *
     * Model baris ini tidak memakai `DataTable` (pola `JournalVoucherItem`), jadi tidak ada kolom `is_example`.
     */
    public function up(): void {
        Schema::create('posting_profile_rules', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('posting_profile_id')->references('id')->on('posting_profiles')->cascadeOnDelete();
            $table->string('document_type', 32)->nullable();
            $table->string('variant', 8)->nullable();
            $table->string('role', 64);
            $table->string('item_type', 64)->nullable();
            $table->boolean('is_stock_item')->nullable();
            $table->foreignUlid('item_category_id')->nullable()->references('id')->on('categories')->restrictOnDelete();
            $table->foreignUlid('account_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();
            $table->unique(
                ['posting_profile_id', 'role', 'document_type', 'variant', 'item_type', 'is_stock_item', 'item_category_id'],
                'posting_profile_rules_conditions_unique',
            );
        });
    }

    public function down(): void {
        Schema::dropIfExists('posting_profile_rules');
    }
};
