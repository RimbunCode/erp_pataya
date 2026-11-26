<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.1 (Requirement 13.2): kolom `posted_account_id` pada `sales_invoice_items` mencatat akun peran
 * per baris (revenue) yang benar-benar dipakai engine posting. Diisi engine saat approve; dikosongkan saat draft
 * diubah (Q-P2-24). Tanpa backfill dokumen lama. Aditif dan reversible.
 *
 * SQLite (test): DDL tabel dijalankan dengan `legacy_alter_table` menyala agar penggantian nama tabel tidak gagal bila
 * ada view yang menunjuk tabel itu. Tidak berpengaruh pada MySQL.
 */
return new class extends Migration
{
    private const string TABLE  = 'sales_invoice_items';
    private const string COLUMN = 'posted_account_id';

    public function up(): void {
        if (Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        $this->withLegacyAlter(function () {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->foreignUlid(self::COLUMN)->nullable()->constrained('accounts')->restrictOnDelete();
            });
        });
    }

    public function down(): void {
        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        $this->withLegacyAlter(function () {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->dropConstrainedForeignId(self::COLUMN);
            });
        });
    }

    private function withLegacyAlter(callable $callback): void {
        $sqlite = DB::connection()->getDriverName() === 'sqlite';
        if ($sqlite) {
            DB::statement('PRAGMA legacy_alter_table = ON');
        }

        try {
            $callback();
        } finally {
            if ($sqlite) {
                DB::statement('PRAGMA legacy_alter_table = OFF');
            }
        }
    }
};
