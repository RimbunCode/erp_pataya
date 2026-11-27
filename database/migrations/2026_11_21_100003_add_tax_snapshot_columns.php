<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private const SNAPSHOT_TABLES = ['sales_invoice_items', 'purchase_invoice_items', 'general_ledgers'];

    /** @var list<string> */
    private const BREAKDOWN_TABLES = ['sales_invoices', 'purchase_invoices'];

    /**
     * Snapshot versi aturan pajak (Finance Fase 3, Requirement 5.1 dan 5.4). Semua kolom nullable: dokumen dan
     * baris jurnal yang dibuat sebelum fase ini tetap valid dan diperlakukan sebagai "legacy" (Requirement 5.5).
     *
     * Rujukan versi memakai `restrictOnDelete` agar versi yang sudah dipakai tidak dapat terhapus diam-diam.
     * Constraint FK hanya dibuat di luar SQLite: menambah FK pada tabel yang sudah ada memaksa SQLite membangun
     * ulang tabel lewat rename-copy, yang gagal selama VIEW laporan (`report_sales_invoices`,
     * `report_purchase_invoices`) merujuk `*_invoice_items`. Di SQLite (hanya dipakai test) kolom tetap ada tanpa
     * constraint; MySQL, yang dipakai staging dan produksi, mendapat constraint penuh.
     */
    public function up(): void {
        $isSqlite = DB::getDriverName() === 'sqlite';

        foreach (self::SNAPSHOT_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($isSqlite) {
                if ($isSqlite) {
                    $table->ulid('tax_rule_version_id')->nullable();

                    return;
                }
                $table->foreignUlid('tax_rule_version_id')->nullable()
                    ->references('id')->on('tax_rule_versions')->restrictOnDelete();
            });
        }

        foreach (self::BREAKDOWN_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->json('tax_breakdown')->nullable();
            });
        }
    }

    public function down(): void {
        $isSqlite = DB::getDriverName() === 'sqlite';

        foreach (self::BREAKDOWN_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('tax_breakdown');
            });
        }

        foreach (self::SNAPSHOT_TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($isSqlite) {
                if (! $isSqlite) {
                    $table->dropForeign(['tax_rule_version_id']);
                }
                $table->dropColumn('tax_rule_version_id');
            });
        }
    }
};
