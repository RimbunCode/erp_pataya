<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->date('depreciation_start_date')->nullable()->after('opening_number_of_booked_depreciations');
            $table->boolean('is_fully_depreciated')->default(false)->after('total_number_of_booked_depreciations');
        });
    }

    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['depreciation_start_date', 'is_fully_depreciated']);
        });
    }
};
