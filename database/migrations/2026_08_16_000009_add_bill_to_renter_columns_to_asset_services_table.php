<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('asset_services', function (Blueprint $table) {
            $table->boolean('bill_to_renter')->default(false)->after('completion_date');
            $table->foreignUlid('customer_id')->nullable()->after('bill_to_renter')
                ->references('id')->on('customers')->nullOnDelete();
            $table->foreignUlid('customer_branch_id')->nullable()->after('customer_id')
                ->references('id')->on('branches')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('asset_services', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropForeign(['customer_branch_id']);
            $table->dropColumn(['bill_to_renter', 'customer_id', 'customer_branch_id']);
        });
    }
};
