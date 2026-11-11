<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Baris Journal Voucher (Task 11.1). `debit`/`credit` `decimal(20,4)` seperti `journals` (D-3); pembulatan ke
     * minor unit mata uang dasar dilakukan `JournalService` saat posting. Akun `restrictOnDelete`: akun yang dipakai
     * voucher tidak dapat dihapus.
     * Model baris tidak memakai `DataTable` (pola `QuotationItem`), jadi tidak ada kolom `is_example`.
     */
    public function up(): void {
        Schema::create('journal_voucher_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('journal_voucher_id')->references('id')->on('journal_vouchers')->cascadeOnDelete();
            $table->foreignUlid('account_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->decimal('debit', 20, 4)->default(0);
            $table->decimal('credit', 20, 4)->default(0);
            $table->text('description')->nullable();
            $table->unsignedInteger('line_no')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('journal_voucher_items');
    }
};
