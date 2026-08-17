<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('asset_movement_items', function (Blueprint $table) {
            $table->decimal('quantity', 15, 4)->default(1)->after('asset_id');
            $table->foreignUlid('customer_id')->nullable()->after('to_custodian_id')
                ->references('id')->on('customers')->nullOnDelete();
            $table->foreignUlid('customer_branch_id')->nullable()->after('customer_id')
                ->references('id')->on('branches')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('asset_movement_items', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropForeign(['customer_branch_id']);
            $table->dropColumn(['customer_id', 'customer_branch_id', 'quantity']);
        });
    }
};
