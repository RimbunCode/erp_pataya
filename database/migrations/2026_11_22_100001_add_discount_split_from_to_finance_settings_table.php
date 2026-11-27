<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setting `finance_discount_split_from.{sales_invoice|purchase_invoice}` (Finance Fase 2, Requirement 14.1; Q-P2-5
     * diputuskan 2026-11-21): tanggal mulai posting diskon terpisah per jenis dokumen. Null = tidak aktif (default).
     * Dua kolom `date` terpisah (bukan JSON) agar penyimpanan lewat form setting umum tidak menimpa kunci lain.
     * Aditif: tidak mengubah baris yang ada.
     */
    public function up(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->date('discount_split_from_sales_invoice')->nullable();
            $table->date('discount_split_from_purchase_invoice')->nullable();
        });
    }

    public function down(): void {
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn(['discount_split_from_sales_invoice', 'discount_split_from_purchase_invoice']);
        });
    }
};
