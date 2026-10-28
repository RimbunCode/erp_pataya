<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('sales_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('quotation_validity_days')->nullable();
        });
    }

    public function down(): void {
        Schema::table('sales_settings', function (Blueprint $table) {
            $table->dropColumn('quotation_validity_days');
        });
    }
};
