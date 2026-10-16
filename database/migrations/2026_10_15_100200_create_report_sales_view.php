<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Penjualan (spec modul-laporan, Req 10).
 *
 * Satu baris per Sales Order. Nilai penjualan adalah DPP (basic_amount dikurangi
 * discount_amount), pajak adalah jumlah tax_amount baris item. Status pengiriman
 * diturunkan dari delivered_quantity dibanding quantity; status pembayaran
 * diturunkan dari outstanding_amount invoice terkait. Keduanya dikembalikan sebagai
 * kode, diterjemahkan di model.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_sales');

        DB::statement(<<<'SQL'
            CREATE VIEW report_sales AS
            SELECT
                so.id AS id,
                so.code AS code,
                so.date AS transaction_date,
                so.customer_id AS customer_id,
                so.customer_name AS customer_name,
                COALESCE(SUM(soi.quantity), 0) AS total_quantity,
                COALESCE(SUM(soi.basic_amount - soi.discount_amount), 0) AS sales_value,
                COALESCE(SUM(soi.tax_amount), 0) AS tax_value,
                CASE
                    WHEN COALESCE(SUM(soi.quantity), 0) = 0 THEN 'belum'
                    WHEN SUM(soi.delivered_quantity) >= SUM(soi.quantity) THEN 'terkirim'
                    WHEN COALESCE(SUM(soi.delivered_quantity), 0) > 0 THEN 'sebagian'
                    ELSE 'belum'
                END AS delivery_status,
                (
                    SELECT MIN(si.code)
                    FROM sales_invoices si
                    WHERE si.sales_order_id = so.id AND si.deleted_at IS NULL
                ) AS invoice_code,
                (
                    SELECT CASE
                        WHEN COUNT(*) = 0 THEN 'belum_ada'
                        WHEN SUM(si.outstanding_amount) <= 0 THEN 'lunas'
                        ELSE 'belum_lunas'
                    END
                    FROM sales_invoices si
                    WHERE si.sales_order_id = so.id AND si.deleted_at IS NULL
                ) AS invoice_status
            FROM sales_orders so
            LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id AND soi.deleted_at IS NULL
            WHERE so.deleted_at IS NULL
            GROUP BY so.id, so.code, so.date, so.customer_id, so.customer_name
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_sales');
    }
};
