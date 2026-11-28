<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pajak majemuk per item invoice (spek finance-multi-tax-per-item, Task 2.1; Requirement 1.1-1.3, 1.6).
 *
 * Satu baris per pasangan (item, pajak): kebenaran per pajak. Kolom item lama (`tax_id`, `tax_rule_version_id`,
 * `tax_rate`, `dpp_amount`, `tax_amount`, `withholding_amount`, `amount`) menjadi cermin Pajak Utama (`position` 0)
 * dan agregat; hanya `InvoiceItemTaxCalculator` yang menulis keduanya.
 *
 * Aditif: tidak menyentuh kolom item, tidak butuh jendela pemeliharaan. Nama indeks unik dipendekkan eksplisit karena
 * nama bawaan Laravel melebihi batas 64 karakter MySQL. Tabel pivot bukan model `DataTable` sehingga tidak ada
 * `is_example`/`have_transactions` (tidak ada `initPermissions()` untuk model pivot).
 *
 * `down()` menghapus kedua tabel (data pajak per pasangan hilang; kolom item tidak berubah dan tetap memuat Pajak
 * Utama serta agregat). Urutan rollback: migrasi backfill dahulu, lalu migrasi ini.
 */
return new class extends Migration
{
    public function up(): void {
        Schema::create('sales_invoice_item_taxes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('sales_invoice_item_id')->constrained('sales_invoice_items', 'id', 'si_item_taxes_item_fk')->cascadeOnDelete();
            $table->foreignUlid('tax_id')->constrained('taxes', 'id', 'si_item_taxes_tax_fk');
            $table->ulid('tax_rule_version_id')->nullable(); // tanpa FK, sama seperti kolom item: versi hilang tampil "tidak tersedia"
            $table->unsignedTinyInteger('position')->default(0);
            $table->decimal('tax_rate', 9, 4)->default(0);
            $table->decimal('dpp_factor', 12, 8)->default(1);
            $table->double('base_amount')->default(0);
            $table->double('dpp_amount')->default(0);
            $table->double('tax_amount')->default(0);
            $table->double('withholding_amount')->default(0);
            $table->timestamps();

            $table->unique(['sales_invoice_item_id', 'tax_id'], 'si_item_taxes_item_tax_unique');
            $table->index('tax_id', 'si_item_taxes_tax_index');
        });

        Schema::create('purchase_invoice_item_taxes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('purchase_invoice_item_id')->constrained('purchase_invoice_items', 'id', 'pi_item_taxes_item_fk')->cascadeOnDelete();
            $table->foreignUlid('tax_id')->constrained('taxes', 'id', 'pi_item_taxes_tax_fk');
            $table->ulid('tax_rule_version_id')->nullable(); // tanpa FK, sama seperti kolom item: versi hilang tampil "tidak tersedia"
            $table->unsignedTinyInteger('position')->default(0);
            $table->decimal('tax_rate', 9, 4)->default(0);
            $table->decimal('dpp_factor', 12, 8)->default(1);
            $table->double('base_amount')->default(0);
            $table->double('dpp_amount')->default(0);
            $table->double('tax_amount')->default(0);
            $table->double('withholding_amount')->default(0);
            $table->timestamps();

            $table->unique(['purchase_invoice_item_id', 'tax_id'], 'pi_item_taxes_item_tax_unique');
            $table->index('tax_id', 'pi_item_taxes_tax_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchase_invoice_item_taxes');
        Schema::dropIfExists('sales_invoice_item_taxes');
    }
};
