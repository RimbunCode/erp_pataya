<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var list<string>
     */
    private const TABLES = ['sales_invoices', 'purchase_invoices', 'payment_entries'];

    /**
     * Jejak kurs pada dokumen (Finance Fase 4, Requirement 3.1): tipe, tanggal, dan sumber kurs yang dipakai, ditambah
     * `exchange_rate_id` (keputusan pemilik produk 28 November 2026) sebagai penanda kurs "dirujuk". Semua nullable:
     * dokumen lama dan dokumen mata uang dasar tidak punya jejak (null = legacy). FK `restrictOnDelete`: baris kurs
     * yang dirujuk tidak dapat dihapus, bahkan lewat SQL langsung. Aditif saja; kolom `exchange_rate` tidak berubah.
     */
    public function up(): void {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignUlid('exchange_rate_id')->nullable()->references('id')->on('exchange_rates')->restrictOnDelete();
                $table->string('exchange_rate_type', 16)->nullable();
                $table->date('exchange_rate_date')->nullable();
                $table->string('exchange_rate_source', 16)->nullable();
            });
        }
    }

    /**
     * FK dilepas lebih dulu, baru kolom (urutan penting di MySQL, galat 1553 bila indeks penopang FK dibuang lebih dulu).
     */
    public function down(): void {
        foreach (array_reverse(self::TABLES) as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['exchange_rate_id']);
            });
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['exchange_rate_id', 'exchange_rate_type', 'exchange_rate_date', 'exchange_rate_source']);
            });
        }
    }
};
