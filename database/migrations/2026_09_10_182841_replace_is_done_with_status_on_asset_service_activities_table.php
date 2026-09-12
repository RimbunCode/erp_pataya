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
        Schema::table('asset_service_activities', function (Blueprint $table) {
            $table->string('status')->nullable()->after('description');
        });

        // Requirement 6 AC3 (keputusan user): drop tanpa backfill.
        Schema::table('asset_service_activities', function (Blueprint $table) {
            $table->dropColumn('is_done');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('asset_service_activities', function (Blueprint $table) {
            $table->boolean('is_done')->default(false);
            $table->dropColumn('status');
        });
    }
};
