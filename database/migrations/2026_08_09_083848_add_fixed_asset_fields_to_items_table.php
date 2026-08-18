<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('items', function (Blueprint $table) {
            $table->boolean('is_fixed_asset')->default(false)->after('is_stock_item');
            $table->foreignUlid('asset_category_id')->nullable()
                ->after('is_fixed_asset')->constrained('asset_categories')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('items', function (Blueprint $table) {
            $table->dropForeign(['asset_category_id']);
            $table->dropColumn(['is_fixed_asset', 'asset_category_id']);
        });
    }
};
