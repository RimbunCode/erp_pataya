<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1-13.2): saat mode engine `on` untuk `asset_value_adjustment`, Asset Value
 * Adjustment dibuat tanpa input akun selisih; kolom akun dokumen menjadi catatan audit yang kelak diisi engine
 * (Task 12.1). Karena itu `asset_value_adjustments.difference_account_id` harus boleh null.
 *
 * Foreign key tidak diubah (tetap `restrictOnDelete`): kolom nullable dengan FK tetap sah dan baris tanpa akun tidak
 * ikut tersentuh aturan FK.
 *
 * Aman dijalankan ulang: kolom yang sudah nullable dilewati.
 *
 * SQLite (test): `change()` membangun ulang tabel; `legacy_alter_table` dinyalakan selama DDL agar penggantian nama
 * tidak gagal bila ada view yang menunjuk tabel. Tidak berpengaruh pada MySQL.
 *
 * `down()` mengembalikan NOT NULL hanya bila tidak ada baris tanpa akun (dokumen yang dibuat saat mode `on`); bila
 * ada, `down()` berhenti SEBELUM DDL apa pun karena akun tidak boleh dikarang.
 */
return new class extends Migration
{
    private const string TABLE  = 'asset_value_adjustments';
    private const string COLUMN = 'difference_account_id';

    public function up(): void {
        $this->alterNullability(true);
    }

    public function down(): void {
        $orphans = DB::table(self::TABLE)->whereNull(self::COLUMN)->count();
        if ($orphans > 0) {
            throw new RuntimeException('Tidak dapat mengembalikan ' . self::TABLE . '.' . self::COLUMN . " menjadi NOT NULL: {$orphans} baris (termasuk soft-deleted) tidak punya akun. Isi akunnya atau hapus barisnya, lalu ulangi rollback.");
        }

        $this->alterNullability(false);
    }

    private function alterNullability(bool $nullable): void {
        $definition = collect(Schema::getColumns(self::TABLE))->firstWhere('name', self::COLUMN);
        if ((bool) ($definition['nullable'] ?? true) === $nullable) {
            return;
        }

        $sqlite = DB::connection()->getDriverName() === 'sqlite';
        if ($sqlite) {
            DB::statement('PRAGMA legacy_alter_table = ON');
        }

        try {
            Schema::table(self::TABLE, function (Blueprint $blueprint) use ($nullable) {
                $blueprint->foreignUlid(self::COLUMN)->nullable($nullable)->change();
            });
        } finally {
            if ($sqlite) {
                DB::statement('PRAGMA legacy_alter_table = OFF');
            }
        }
    }
};
