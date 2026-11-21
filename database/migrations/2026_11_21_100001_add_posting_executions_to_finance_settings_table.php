<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting `finance_posting_execution.{document_type}` (Finance Fase 2, Requirement 9.2; D-1 diputuskan opsi C,
     * 2026-11-21): peta jenis dokumen => `inline`/`queue` dalam satu kolom JSON. Null/tidak ada kunci berarti `inline`.
     * Ditulis hanya lewat `PostingExecutionService` (izin `switch_posting_mode`).
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->json('posting_executions')->nullable();
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn('posting_executions');
        });
    }
};
