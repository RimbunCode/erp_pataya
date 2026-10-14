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
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->string('supplier_invoice')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropColumn('supplier_invoice');
        });
    }
};
