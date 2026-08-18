<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        // Tambah discount_amount SEBELUM drop chain generated -- basic_amount tetap
        // kotor (quantity * price), diskon dokumen disimpan terpisah di kolom ini,
        // bukan menimpa basic_amount seperti pola SalesOrderItem/PurchaseOrderItem.
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('discount_amount')->default(0)->after('basic_amount');
        });

        // tax_amount -> dpp_amount saling mereferensikan berurutan -- drop dari yang
        // paling bergantung dulu (SQLite table-rebuild per panggilan Schema::table()).
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('dpp_amount');
        });

        // dpp_amount sekarang basis-nya (basic_amount - discount_amount), bukan
        // basic_amount langsung -- DPP dihitung SETELAH diskon (Requirement 1 spec
        // dpp-discount-and-tax-compliance), formula 11/12 tetap sama (spec
        // invoice-dpp-adjustment, tidak diubah).
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('dpp_amount')->storedAs('(basic_amount - discount_amount) * 11 / 12')->after('discount_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('tax_amount')->storedAs('dpp_amount * tax_rate / 100')->after('dpp_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('dpp_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('dpp_amount')->storedAs('basic_amount * 11 / 12')->after('basic_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('tax_amount')->storedAs('dpp_amount * tax_rate / 100')->after('dpp_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('discount_amount');
        });
    }
};
