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
        Schema::table('asset_categories', function (Blueprint $table) {
            $table->dropColumn(['is_rentable', 'allow_bulk_quantity']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('asset_categories', function (Blueprint $table) {
            $table->boolean('is_rentable')->default(false);
            $table->boolean('allow_bulk_quantity')->default(false);
        });
    }
};
