<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting Tax Engine (Finance Fase 3, Requirement 2.7, 7.5, 7.9; PRD D-25). Nama kolom tanpa awalan modul,
     * mengikuti kolom `finance_settings` yang ada:
     *
     * - `tax_split_from`: peta jenis dokumen (`sales_invoice`, `purchase_invoice`) => tanggal cutover pemisahan
     *   baris pajak di jurnal (`finance_tax_split_from.*`). Null/kunci kosong berarti tidak aktif (default).
     * - `company_is_pkp` (`finance_company_is_pkp`): default true; menunggu D-12/Q-P3-2.
     * - `tax_engine_calc_enabled` (`finance_tax_engine_calc_enabled`): default false; hanya diaktifkan migrasi
     *   Bagian B. Selama false, versi aturan berfaktor DPP selain 11/12 ditolak (guard F-17).
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->json('tax_split_from')->nullable();
            $table->boolean('company_is_pkp')->default(true);
            $table->boolean('tax_engine_calc_enabled')->default(false);
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn(['tax_split_from', 'company_is_pkp', 'tax_engine_calc_enabled']);
        });
    }
};
