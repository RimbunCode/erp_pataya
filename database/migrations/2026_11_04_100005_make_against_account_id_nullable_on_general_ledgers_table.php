<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Requirement 1.3: jurnal dengan 3 baris atau lebih tidak memiliki satu akun lawan, sehingga
     * `against_account_id` menjadi nullable. Hanya melonggarkan NOT NULL (tipe dan FK tidak berubah);
     * perubahan tipe `debit`/`credit` dan FK `restrictOnDelete` tetap di Task 8.3.
     *
     * Dipisah dari Task 8.3 dan dimajukan ke Task 2 karena `JournalService::post()` (Task 4) harus dapat
     * menyimpan jurnal 3 baris atau lebih. Lihat `design.md` (hasil verifikasi Task 1) dan pertanyaan Q-P1-3.
     */
    public function up(): void {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->foreignUlid('against_account_id')->nullable()->change();
        });
    }

    /**
     * Mengembalikan NOT NULL hanya bila tidak ada baris dengan `against_account_id` null (jurnal 3 baris atau lebih
     * tidak dapat dipulihkan ke skema lama).
     */
    public function down(): void {
        if (DB::table('general_ledgers')->whereNull('against_account_id')->exists()) {
            throw new RuntimeException('Tidak dapat mengembalikan against_account_id menjadi NOT NULL: ada baris general_ledgers tanpa akun lawan (jurnal 3 baris atau lebih).');
        }

        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->foreignUlid('against_account_id')->nullable(false)->change();
        });
    }
};
