<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Mutasi Stock (spec modul-laporan, Req 9).
 *
 * View ini menyajikan satu baris per entri stock_ledger_entries yang belum
 * dihapus, beserta kode dan nama item serta gudangnya. Jenis transaksi tidak
 * disimpan di view: referenceable_type dibiarkan apa adanya lalu diterjemahkan
 * di kode oleh TransactionTypeLabeler (Req 9.4), supaya peta label hanya ada di
 * satu tempat.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_stock_mutations');

        DB::statement(<<<'SQL'
            CREATE VIEW report_stock_mutations AS
            SELECT
                sle.id AS id,
                sle.transaction_date AS transaction_date,
                sle.item_id AS item_variant_id,
                sle.warehouse_id AS warehouse_id,
                w.branch_id AS branch_id,
                iv.code AS item_code,
                iv.item_name AS item_name,
                w.name AS warehouse_name,
                sle.referenceable_type AS referenceable_type,
                sle.referenceable_id AS referenceable_id,
                sle.quantity_change AS quantity_change,
                sle.quantity_after_transaction AS quantity_after_transaction
            FROM stock_ledger_entries sle
            INNER JOIN item_variants iv ON iv.id = sle.item_id
            INNER JOIN warehouses w ON w.id = sle.warehouse_id
            WHERE sle.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_stock_mutations');
    }
};
