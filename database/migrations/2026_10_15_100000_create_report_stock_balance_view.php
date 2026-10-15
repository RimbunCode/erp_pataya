<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Stok Persediaan (spec modul-laporan, Req 8).
 *
 * View ini menyajikan satu baris per stok (item x gudang) beserta nilai
 * persediaannya. Tabel laporan dan KPI membaca view yang sama, sehingga
 * definisi kolomnya hanya ada di satu tempat (Req 4.1).
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_stock_balances');

        DB::statement(<<<'SQL'
            CREATE VIEW report_stock_balances AS
            SELECT
                s.id AS id,
                s.item_variant_id AS item_variant_id,
                s.warehouse_id AS warehouse_id,
                w.branch_id AS branch_id,
                iv.category_id AS category_id,
                iv.code AS item_code,
                iv.item_name AS item_name,
                w.name AS warehouse_name,
                u.name AS unit_name,
                s.actual_quantity AS quantity,
                s.valuation_rate AS valuation_rate,
                s.actual_quantity * s.valuation_rate AS stock_value
            FROM stocks s
            INNER JOIN item_variants iv ON iv.id = s.item_variant_id
            INNER JOIN warehouses w ON w.id = s.warehouse_id
            LEFT JOIN item_units iu ON iu.id = s.item_unit_id
            LEFT JOIN units u ON u.id = iu.unit_id
            WHERE s.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_stock_balances');
    }
};
