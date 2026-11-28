<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting FX Engine (Finance Fase 4, Requirement 2.1-2.2). Nama kolom tanpa awalan modul, mengikuti kolom
     * `finance_settings` yang ada:
     *
     * - `fx_max_age_days` (`finance_fx_max_age_days`): umur maksimum kurs terdekat sebelum tanggal transaksi (hari).
     * - `fx_allow_inverse` (`finance_fx_allow_inverse`): izinkan kurs kebalikan `1/rate`.
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('fx_max_age_days')->default(7);
            $table->boolean('fx_allow_inverse')->default(true);
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn(['fx_max_age_days', 'fx_allow_inverse']);
        });
    }
};
