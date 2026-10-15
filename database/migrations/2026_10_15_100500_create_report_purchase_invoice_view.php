<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel dan KPI Laporan Invoice Pembelian (spec modul-laporan, Req 13).
 *
 * Satu baris per Purchase Invoice. Nomor yang tampil adalah supplier_invoice (nomor
 * dari supplier), bukan code internal. Total pelunasan dihitung dari Payment Entry yang
 * paymentable-nya invoice ini (sisi bayar, paymentable PurchaseInvoice).
 *
 * Paymentable_type disimpan sebagai FQCN. Pencocokan memakai LIKE '%PurchaseInvoice'
 * agar tidak bergantung pada aturan escape backslash MySQL dan SQLite.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_purchase_invoices');

        DB::statement(<<<'SQL'
            CREATE VIEW report_purchase_invoices AS
            SELECT
                pi.id AS id,
                pi.supplier_invoice AS supplier_invoice,
                pi.code AS code,
                pi.date AS transaction_date,
                pi.supplier_id AS supplier_id,
                pi.supplier_name AS supplier_name,
                pi.purchase_order_id AS purchase_order_id,
                (SELECT po.code FROM purchase_orders po WHERE po.id = pi.purchase_order_id) AS purchase_order_code,
                COALESCE(pi.tax_invoice_dpp_amount, 0) AS dpp_value,
                COALESCE(pi.discount_amount, 0) AS discount_value,
                COALESCE(pi.tax_invoice_ppn_amount, 0) AS tax_value,
                pi.amount AS total_amount,
                (
                    SELECT COALESCE(SUM(pe.paid_amount), 0)
                    FROM payment_entries pe
                    WHERE pe.paymentable_type LIKE '%PurchaseInvoice'
                        AND pe.paymentable_id = pi.id
                        AND pe.deleted_at IS NULL
                ) AS paid_total,
                (
                    SELECT MAX(pe.date)
                    FROM payment_entries pe
                    WHERE pe.paymentable_type LIKE '%PurchaseInvoice'
                        AND pe.paymentable_id = pi.id
                        AND pe.deleted_at IS NULL
                ) AS last_payment_date,
                pi.outstanding_amount AS outstanding_amount,
                pi.external_note AS external_note,
                (
                    SELECT COUNT(*)
                    FROM purchase_invoice_items pii
                    WHERE pii.purchase_invoice_id = pi.id AND pii.deleted_at IS NULL
                ) AS item_count,
                CASE
                    WHEN pi.outstanding_amount <= 0 THEN 'lunas'
                    WHEN pi.paid_amount > 0 THEN 'sebagian'
                    ELSE 'belum'
                END AS payment_status
            FROM purchase_invoices pi
            WHERE pi.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_purchase_invoices');
    }
};
