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
        Schema::table('sales_invoices', function (Blueprint $table) {
            $table->string('tax_invoice_transaction_code')->nullable()->after('discount_amount_base_currency');
            $table->string('tax_invoice_serial_number')->nullable()->unique()->after('tax_invoice_transaction_code');
            $table->timestamp('tax_invoice_date')->nullable()->after('tax_invoice_serial_number');
            $table->double('tax_invoice_dpp_amount')->default(0)->after('tax_invoice_date');
            $table->double('tax_invoice_ppn_amount')->default(0)->after('tax_invoice_dpp_amount');
            $table->double('tax_invoice_ppnbm_amount')->default(0)->after('tax_invoice_ppn_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('sales_invoices', function (Blueprint $table) {
            $table->dropColumn([
                'tax_invoice_transaction_code',
                'tax_invoice_serial_number',
                'tax_invoice_date',
                'tax_invoice_dpp_amount',
                'tax_invoice_ppn_amount',
                'tax_invoice_ppnbm_amount',
            ]);
        });
    }
};
