<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Invoice Penjualan (spec modul-laporan, Req 11).
 *
 * Satu baris per Sales Invoice. Total pelunasan dan tanggal pelunasan terakhir dihitung
 * dari Payment Entry yang paymentable-nya invoice ini (Req 11.5). Status pembayaran
 * diturunkan dari outstanding_amount dan paid_amount, dan dikembalikan sebagai kode.
 *
 * Paymentable_type disimpan sebagai FQCN. Pencocokan memakai LIKE '%SalesInvoice' agar
 * tidak bergantung pada aturan escape backslash yang berbeda antara MySQL dan SQLite.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_sales_invoices');

        DB::statement(<<<'SQL'
            CREATE VIEW report_sales_invoices AS
            SELECT
                si.id AS id,
                si.code AS code,
                si.date AS transaction_date,
                si.customer_id AS customer_id,
                si.customer_name AS customer_name,
                si.sales_order_id AS sales_order_id,
                (SELECT so.code FROM sales_orders so WHERE so.id = si.sales_order_id) AS sales_order_code,
                COALESCE(si.tax_invoice_dpp_amount, 0) AS dpp_value,
                COALESCE(si.tax_invoice_ppn_amount, 0) AS tax_value,
                si.amount AS total_amount,
                (
                    SELECT COALESCE(SUM(pe.paid_amount), 0)
                    FROM payment_entries pe
                    WHERE pe.paymentable_type LIKE '%SalesInvoice'
                        AND pe.paymentable_id = si.id
                        AND pe.deleted_at IS NULL
                ) AS paid_total,
                (
                    SELECT MAX(pe.date)
                    FROM payment_entries pe
                    WHERE pe.paymentable_type LIKE '%SalesInvoice'
                        AND pe.paymentable_id = si.id
                        AND pe.deleted_at IS NULL
                ) AS last_payment_date,
                si.outstanding_amount AS outstanding_amount,
                (
                    SELECT COUNT(*)
                    FROM sales_invoice_items sii
                    WHERE sii.sales_invoice_id = si.id AND sii.deleted_at IS NULL
                ) AS item_count,
                CASE
                    WHEN si.outstanding_amount <= 0 THEN 'lunas'
                    WHEN si.paid_amount > 0 THEN 'sebagian'
                    ELSE 'belum'
                END AS payment_status
            FROM sales_invoices si
            WHERE si.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_sales_invoices');
    }
};
