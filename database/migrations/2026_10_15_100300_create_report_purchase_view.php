<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Pembelian (spec modul-laporan, Req 12).
 *
 * Satu baris per Purchase Order. Nilai pembelian adalah DPP (basic_amount dikurangi
 * discount_amount), pajak adalah jumlah tax_amount baris item.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_purchases');

        DB::statement(<<<'SQL'
            CREATE VIEW report_purchases AS
            SELECT
                po.id AS id,
                po.code AS code,
                po.date AS transaction_date,
                po.supplier_id AS supplier_id,
                po.supplier_name AS supplier_name,
                COALESCE(SUM(poi.quantity), 0) AS total_quantity,
                COALESCE(SUM(poi.basic_amount - poi.discount_amount), 0) AS purchase_value,
                COALESCE(SUM(poi.tax_amount), 0) AS tax_value
            FROM purchase_orders po
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id AND poi.deleted_at IS NULL
            WHERE po.deleted_at IS NULL
            GROUP BY po.id, po.code, po.date, po.supplier_id, po.supplier_name
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_purchases');
    }
};
