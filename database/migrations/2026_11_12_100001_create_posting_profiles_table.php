<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Posting Profile berversi (Finance Fase 2, Requirement 2.1): global (tanpa kolom cakupan/cabang), berlaku pada
     * rentang tanggal, dengan rantai versi lewat `previous_profile_id`.
     *
     * `is_example` (+ indeks) dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 11.2): persis kolom
     * yang akan ditambahkan `DataTable::initPermissions()` untuk model non-submitable tanpa kode series, sehingga
     * `initPermissions()` no-op pada tabel ini.
     */
    public function up(): void {
        Schema::create('posting_profiles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->foreignUlid('previous_profile_id')->nullable()->references('id')->on('posting_profiles')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
            $table->index(['status', 'effective_from'], 'posting_profiles_status_effective_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('posting_profiles');
    }
};
