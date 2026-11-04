<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aditif saja (Requirement 1.2): kolom baru nullable; tipe `debit`/`credit` dan FK akun tidak diubah di sini
     * (Task 8). Kolom `foreign_*` dan `exchange_rate` hanya disiapkan untuk Fase 4.
     */
    public function up(): void {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->foreignUlid('journal_id')->nullable()->references('id')->on('journals')->restrictOnDelete();
            $table->unsignedSmallInteger('line_no')->nullable();
            $table->string('foreign_currency_code', 10)->nullable();
            $table->foreign('foreign_currency_code')->references('code')->on('currencies')->restrictOnDelete();
            $table->decimal('foreign_debit', 20, 4)->nullable();
            $table->decimal('foreign_credit', 20, 4)->nullable();
            $table->decimal('exchange_rate', 20, 8)->nullable();

            $table->index(['account_id', 'transaction_date']);
            $table->index(['journal_id', 'line_no']);
        });
    }

    /**
     * Urutan penting di MySQL (galat 1553 "needed in a foreign key constraint"): FK dilepas lebih dulu, baru indeks
     * yang menopangnya. Indeks komposit `(account_id, transaction_date)` dapat menggantikan indeks tunggal
     * `account_id` yang dibuat otomatis untuk FK akun (MySQL membuangnya diam-diam saat indeks komposit dibuat), jadi
     * indeks tunggal dibuat ulang bila belum ada sebelum indeks komposit dibuang.
     */
    public function down(): void {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dropForeign(['journal_id']);
            $table->dropForeign(['foreign_currency_code']);
        });

        $hasSingleAccountIndex = collect(Schema::getIndexes('general_ledgers'))
            ->contains(fn (array $index) => $index['columns'] === ['account_id']);

        Schema::table('general_ledgers', function (Blueprint $table) use ($hasSingleAccountIndex) {
            if (! $hasSingleAccountIndex) {
                $table->index('account_id');
            }
        });

        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dropIndex(['journal_id', 'line_no']);
            $table->dropIndex(['account_id', 'transaction_date']);
            $table->dropColumn(['journal_id', 'line_no', 'foreign_currency_code', 'foreign_debit', 'foreign_credit', 'exchange_rate']);
        });
    }
};
