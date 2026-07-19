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
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->double('dpp_amount')->storedAs('basic_amount * 11 / 12')->after('basic_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
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
            $table->double('tax_amount')->storedAs('basic_amount * tax_rate / 100')->after('basic_amount');
        });

        Schema::table('sales_invoice_items', function (Blueprint $table) {
            $table->dropColumn('dpp_amount');
        });
    }
};
