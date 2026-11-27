<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Versi aturan pajak berlaku-tanggal (Finance Fase 3, Requirement 2.1): tarif, faktor DPP (pecahan bilangan
     * bulat), mode pembulatan, dan peran akun (kunci peran Posting Profile, bukan akun) untuk satu pajak pada
     * rentang tanggal. Versi `active` yang sudah dirujuk dokumen tidak diedit; perubahan lewat versi baru.
     *
     * `is_example` (+ indeks) dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 13.2): persis
     * kolom yang akan ditambahkan `DataTable::initPermissions()` untuk model non-submitable tanpa kode series,
     * sehingga `initPermissions()` no-op pada tabel ini.
     */
    public function up(): void {
        Schema::create('tax_rule_versions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('tax_id')->references('id')->on('taxes')->restrictOnDelete();
            $table->unsignedSmallInteger('version');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->decimal('rate', 9, 4);
            $table->unsignedSmallInteger('dpp_numerator')->default(1);
            $table->unsignedSmallInteger('dpp_denominator')->default(1);
            $table->string('rounding_mode', 16)->default('per_line');
            $table->string('output_role', 64)->default('tax_output');
            $table->string('input_role', 64)->default('tax_input');
            $table->string('status', 16)->default('draft');
            $table->text('notes')->nullable();
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
            $table->unique(['tax_id', 'version']);
            $table->index(['tax_id', 'status', 'effective_from'], 'tax_rule_versions_effective_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('tax_rule_versions');
    }
};
