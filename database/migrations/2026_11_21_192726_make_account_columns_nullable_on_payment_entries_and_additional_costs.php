<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1-13.2): saat mode engine `on`, Payment Entry dan Stock Entry (biaya
 * tambahan) dibuat tanpa input akun; kolom akun dokumen menjadi catatan audit yang kelak diisi engine (Task 12.1).
 * Karena itu `payment_entries.account_paid_to_id`, `payment_entries.account_paid_from_id`, dan
 * `additional_costs.expense_account_id` harus boleh null. (`stock_entries.difference_account_id` sudah nullable.)
 *
 * Foreign key tidak diubah: `payment_entries.*` tetap `restrictOnDelete`, `additional_costs.expense_account_id` tetap
 * `cascadeOnDelete`; kolom nullable dengan FK tetap sah dan baris tanpa akun tidak ikut tersentuh aturan FK.
 *
 * Aman dijalankan ulang: kolom yang sudah nullable dilewati.
 *
 * SQLite (test): `change()` membangun ulang tabel (buat tabel sementara, salin, hapus, ganti nama). View laporan
 * (`report_sales_invoices`, `report_purchase_invoices`) membaca `payment_entries`; tanpa `legacy_alter_table`
 * penggantian nama gagal karena view dianggap menunjuk tabel yang tidak ada. Flag itu hanya dinyalakan selama DDL
 * dan tidak berpengaruh pada MySQL (`MODIFY` biasa, view tidak tersentuh).
 *
 * `down()` mengembalikan NOT NULL hanya bila tidak ada baris yang kolomnya null (dokumen yang dibuat saat mode `on`).
 * Bila ada, `down()` berhenti SEBELUM DDL apa pun dengan pesan yang menyebut jumlah barisnya: kolom itu tidak dapat
 * dikembalikan ke NOT NULL tanpa mengarang akun. Isi akunnya dulu (atau hapus barisnya) lalu ulangi rollback.
 */
return new class extends Migration
{
    /** @var array<string, list<string>> */
    private const array COLUMNS = [
        'payment_entries'  => ['account_paid_to_id', 'account_paid_from_id'],
        'additional_costs' => ['expense_account_id'],
    ];

    public function up(): void {
        $this->alterNullability(true);
    }

    public function down(): void {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                $orphans = DB::table($table)->whereNull($column)->count();
                if ($orphans > 0) {
                    throw new RuntimeException("Tidak dapat mengembalikan {$table}.{$column} menjadi NOT NULL: {$orphans} baris (termasuk soft-deleted) tidak punya akun. Isi akunnya atau hapus barisnya, lalu ulangi rollback.");
                }
            }
        }

        $this->alterNullability(false);
    }

    private function alterNullability(bool $nullable): void {
        $sqlite = DB::connection()->getDriverName() === 'sqlite';
        if ($sqlite) {
            DB::statement('PRAGMA legacy_alter_table = ON');
        }

        try {
            foreach (self::COLUMNS as $table => $columns) {
                $toChange = array_values(array_filter($columns, fn (string $column): bool => $this->isNullable($table, $column) !== $nullable));
                if ($toChange === []) {
                    continue;
                }

                Schema::table($table, function (Blueprint $blueprint) use ($toChange, $nullable) {
                    foreach ($toChange as $column) {
                        $blueprint->foreignUlid($column)->nullable($nullable)->change();
                    }
                });
            }
        } finally {
            if ($sqlite) {
                DB::statement('PRAGMA legacy_alter_table = OFF');
            }
        }
    }

    private function isNullable(string $table, string $column): bool {
        $definition = collect(Schema::getColumns($table))->firstWhere('name', $column);

        return (bool) ($definition['nullable'] ?? true);
    }
};
