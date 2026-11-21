<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 1, Task 9.1 (Rilis 2; Requirement 13.5; BR-7): `general_ledgers.journal_id` menjadi NOT NULL.
 *
 * Pengaman: sebelum DDL apa pun (DDL MySQL tidak transaksional), `up()` menolak jalan bila masih ada baris tanpa
 * `journal_id`, aktif maupun soft-deleted (query builder tidak menerapkan soft delete; backfill mengubah baris
 * soft-deleted menjadi jurnal `voided`, I-1). Pengaman ini bukan pengatur urutan rilis: urutannya dijaga BR-7 (disederhanakan
 * 2026-11-21 karena GL produksi kosong). Bila gagal, jalankan `finance:backfill-journals` lalu deploy ulang.
 *
 * Aman dijalankan ulang: bila kolom sudah NOT NULL, tidak melakukan apa pun.
 */
return new class extends Migration
{
    public function up(): void {
        if (! $this->journalIdIsNullable()) {
            return;
        }

        $orphans = DB::table('general_ledgers')->whereNull('journal_id')->count();
        if ($orphans > 0) {
            throw new RuntimeException("Tidak dapat mengubah general_ledgers.journal_id menjadi NOT NULL: {$orphans} baris (termasuk soft-deleted) belum punya journal_id. Jalankan `php artisan finance:backfill-journals`, pastikan `finance:reconcile-ledger` hijau, lalu ulangi migrasi.");
        }

        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->foreignUlid('journal_id')->nullable(false)->change();
        });
    }

    public function down(): void {
        if ($this->journalIdIsNullable()) {
            return;
        }

        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->foreignUlid('journal_id')->nullable()->change();
        });
    }

    private function journalIdIsNullable(): bool {
        $column = collect(Schema::getColumns('general_ledgers'))->firstWhere('name', 'journal_id');

        return (bool) ($column['nullable'] ?? true);
    }
};
