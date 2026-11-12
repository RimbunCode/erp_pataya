<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catatan perbandingan parity mode `shadow` (Finance Fase 2, Requirement 6.6): tidak pernah diubah (hanya
     * `created_at`), dibersihkan `finance:prune-parity-logs`. `status`: `match`/`rounding`/`config_diff`/`mismatch`/
     * `engine_error`. Ringkasan `legacy`/`engine` nullable karena `engine_error` tidak punya sisi engine.
     *
     * `is_example` (+ indeks) dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 11.2).
     */
    public function up(): void {
        Schema::create('posting_parity_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('document_type', 32);
            $table->string('source_type');
            $table->string('source_id', 36);
            $table->string('status', 16);
            $table->json('legacy')->nullable();
            $table->json('engine')->nullable();
            $table->json('diff')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
            $table->index(['document_type', 'status', 'created_at'], 'posting_parity_logs_type_status_created_index');
            $table->index(['source_type', 'source_id'], 'posting_parity_logs_source_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('posting_parity_logs');
    }
};
