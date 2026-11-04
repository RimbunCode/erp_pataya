<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Header jurnal (Finance Fase 1, Requirement 1.1). Tanpa `deleted_at`: jurnal tidak pernah dihapus.
     *
     * `code` (NOT NULL, unik), `is_example` (+ indeks), dan `have_transactions` dideklarasikan eksplisit (F-12,
     * Requirement 1.7): persis kolom yang akan ditambahkan `DataTable::initPermissions()` untuk model non-submitable
     * dengan `$generateCodeSeries`, sehingga `initPermissions()` no-op pada tabel ini.
     */
    public function up(): void {
        Schema::create('journals', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->dateTime('transaction_date')->index();
            $table->foreignUlid('fiscal_period_id')->nullable()->references('id')->on('fiscal_periods')->restrictOnDelete();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
            $table->string('status', 16)->default('posted');
            $table->nullableUlidMorphs('source');
            $table->string('posting_key', 191)->nullable()->unique();
            $table->foreignUlid('reverses_journal_id')->nullable()->references('id')->on('journals')->restrictOnDelete();
            $table->foreignUlid('reversed_by_journal_id')->nullable()->references('id')->on('journals')->restrictOnDelete();
            $table->text('reversal_reason')->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete();
            $table->text('description')->nullable();
            $table->decimal('total_debit', 20, 4)->default(0);
            $table->decimal('total_credit', 20, 4)->default(0);
            $table->timestamp('posted_at')->useCurrent();
            $table->foreignUlid('posted_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->boolean('legacy_origin')->default(false);
            $table->boolean('legacy_unbalanced')->default(false);
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
        });
    }

    public function down(): void {
        Schema::dropIfExists('journals');
    }
};
