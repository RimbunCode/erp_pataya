<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting `finance_posting_mode.{document_type}` (Finance Fase 2, Requirement 6.1): peta jenis dokumen => mode
     * (`off`/`shadow`/`on`) dalam satu kolom JSON. Null/tidak ada kunci berarti `off`. Ditulis hanya lewat
     * `PostingModeService` (izin `switch_posting_mode`).
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->json('posting_modes')->nullable();
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn('posting_modes');
        });
    }
};
