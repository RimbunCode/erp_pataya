<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel Laporan Monitoring Work Order (spec modul-laporan, Req 14).
 *
 * Berbasis AssetService, bukan Service\WorkOrder. Satu baris per AssetService. Tanggal
 * transaksi adalah tanggal kerusakan (failure_date). Lama pengerjaan tidak dihitung di
 * view karena selisih tanggal belum portable antara MySQL dan SQLite. Ia dihitung di model
 * dan KPI builder dari start_date dan completion_date.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_work_orders');

        DB::statement(<<<'SQL'
            CREATE VIEW report_work_orders AS
            SELECT
                svc.id AS id,
                svc.code AS code,
                svc.type AS service_type,
                svc.asset_id AS asset_id,
                a.asset_name AS asset_name,
                svc.failure_date AS transaction_date,
                svc.start_date AS start_date,
                svc.completion_date AS completion_date,
                CASE WHEN svc.completion_date IS NULL THEN 'berjalan' ELSE 'selesai' END AS progress_status
            FROM asset_services svc
            LEFT JOIN assets a ON a.id = svc.asset_id
            WHERE svc.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_work_orders');
    }
};
