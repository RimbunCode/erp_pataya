<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 14.2 (Requirement 13.8): hapus kolom non-standar `accounts.is_contra`.
 *
 * Retur memakai akun lewat aturan `variant=return` pada Posting Profile, dan laporan Fase 5 memakai saldo
 * bertanda, jadi tidak ada lagi pembaca kolom ini.
 *
 * Prasyarat deploy: semua jenis dokumen sudah berada pada mode `on` dan Task 12.3 selesai, karena jalur
 * `off`/`shadow` lama tidak lagi membaca kolom ini (default akun retur di `SalesInvoiceController` dibuang).
 *
 * `down()` menambah kembali kolom dengan atribut aslinya (`boolean`, default `false`, setelah
 * `balance_amount`), tetapi nilai flag yang sudah dihapus TIDAK dapat dipulihkan: semua baris kembali bernilai
 * `false` (termasuk akun seperti Akumulasi Penyusutan, Retur Penjualan, dan Potongan Penjualan yang semula `true`).
 * Pulihkan dari cadangan basis data bila nilai lama dibutuhkan.
 */
return new class extends Migration
{
    public function up(): void {
        if (Schema::hasColumn('accounts', 'is_contra')) {
            Schema::table('accounts', function (Blueprint $table) {
                $table->dropColumn('is_contra');
            });
        }
    }

    public function down(): void {
        if (! Schema::hasColumn('accounts', 'is_contra')) {
            Schema::table('accounts', function (Blueprint $table) {
                $table->boolean('is_contra')->default(false)->after('balance_amount');
            });
        }
    }
};
