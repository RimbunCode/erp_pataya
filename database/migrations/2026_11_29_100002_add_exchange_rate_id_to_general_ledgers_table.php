<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penanda kurs yang dirujuk baris jurnal (Finance Fase 4, keputusan pemilik produk 28 November 2026): nullable FK
     * `restrictOnDelete` ke `exchange_rates`. Dipisah dari migration dokumen karena `general_ledgers` adalah tabel
     * terbesar: di MySQL 8, menambah FK dengan `foreign_key_checks=1` memakai ALGORITHM=COPY (membangun ulang tabel
     * dan memblokir tulis), sehingga migration ini dapat dijadwalkan sendiri pada jendela pemeliharaan.
     * `legacy_alter_table` hanya untuk SQLite (lihat migration jejak kurs dokumen).
     */
    public function up(): void {
        $this->legacyAlter(function (): void {
            Schema::table('general_ledgers', function (Blueprint $table) {
                $table->foreignUlid('exchange_rate_id')->nullable()->references('id')->on('exchange_rates')->restrictOnDelete();
            });
        });
    }

    public function down(): void {
        $this->legacyAlter(function (): void {
            Schema::table('general_ledgers', function (Blueprint $table) {
                $table->dropForeign(['exchange_rate_id']);
            });
            Schema::table('general_ledgers', function (Blueprint $table) {
                $table->dropColumn('exchange_rate_id');
            });
        });
    }

    private function legacyAlter(callable $callback): void {
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
