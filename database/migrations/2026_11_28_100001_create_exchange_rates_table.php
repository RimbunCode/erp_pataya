<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Master kurs bertipe (Finance Fase 4, Requirement 1.1): satu baris per pasangan mata uang, tipe, dan tanggal.
     * Kurs yang sudah dirujuk transaksi tidak diubah (guard di model `ExchangeRate`).
     *
     * `is_example` (+ indeks) dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 12.3): persis kolom
     * yang akan ditambahkan `DataTable::initPermissions()` untuk model non-submitable tanpa kode series, sehingga
     * `initPermissions()` no-op pada tabel ini. Tanpa soft delete.
     */
    public function up(): void {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('from_currency_code', 10);
            $table->string('to_currency_code', 10);
            $table->string('rate_type', 16);
            $table->decimal('rate', 20, 8);
            $table->date('rate_date');
            $table->string('source', 16);
            $table->string('source_ref')->nullable();
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);

            $table->foreign('from_currency_code')->references('code')->on('currencies')->restrictOnDelete();
            $table->foreign('to_currency_code')->references('code')->on('currencies')->restrictOnDelete();
            $table->unique(['from_currency_code', 'to_currency_code', 'rate_type', 'rate_date'], 'exchange_rates_pair_type_date_unique');
        });
    }

    public function down(): void {
        Schema::dropIfExists('exchange_rates');
    }
};
