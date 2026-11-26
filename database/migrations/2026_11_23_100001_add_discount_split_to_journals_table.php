<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bentuk jurnal yang direkam saat posting (Finance Fase 2, Requirement 14.8; keputusan pemilik produk 22 November
     * 2026 "retur mengikuti bentuk invoice asal"): true bila jurnal memuat baris berperan `discount` (posting diskon
     * terpisah), false bila bersih. Retur Sales Invoice dan Purchase Invoice membaca kolom ini dari jurnal invoice asal,
     * sehingga bentuknya tak berubah walau cutover dipindah atau dikosongkan sesudah invoice asal diposting.
     *
     * Nullable: null = belum direkam (jurnal yang diposting sebelum kolom ini ada); pembaca jatuh ke pembandingan tanggal
     * jurnal terhadap setting cutover saat ini. Aditif: tidak mengubah baris yang ada.
     */
    public function up(): void {
        Schema::table('journals', function (Blueprint $table) {
            $table->boolean('discount_split')->nullable()->after('legacy_unbalanced');
        });
    }

    public function down(): void {
        Schema::table('journals', function (Blueprint $table) {
            $table->dropColumn('discount_split');
        });
    }
};
