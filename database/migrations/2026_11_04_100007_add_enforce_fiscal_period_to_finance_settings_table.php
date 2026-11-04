<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting `finance_enforce_fiscal_period` (PRD D-25; Q-P1-2: nonaktif dulu, diaktifkan manual).
     * Kolom memakai nama tanpa awalan modul, mengikuti kolom `finance_settings` yang ada.
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->boolean('enforce_fiscal_period')->default(false);
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn('enforce_fiscal_period');
        });
    }
};
