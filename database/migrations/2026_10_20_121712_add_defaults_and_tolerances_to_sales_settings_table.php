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
        Schema::table('sales_settings', function (Blueprint $table) {
            $table->foreignUlid('default_source_warehouse_id')->nullable()->after('default_tax_id')->constrained('warehouses')->nullOnDelete();
            $table->decimal('over_delivery_tolerance_percent', 5, 2)->nullable()->default(null);
            $table->decimal('over_billing_tolerance_percent', 5, 2)->nullable()->default(null);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('sales_settings', function (Blueprint $table) {
            $table->dropForeign(['default_source_warehouse_id']);
            $table->dropColumn(['default_source_warehouse_id', 'over_delivery_tolerance_percent', 'over_billing_tolerance_percent']);
        });
    }
};
