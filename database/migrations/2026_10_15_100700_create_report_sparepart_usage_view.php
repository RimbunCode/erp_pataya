<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel Laporan Pemakaian Sparepart (spec modul-laporan, Req 15).
 *
 * Satu baris per item yang dikonsumsi pada sebuah AssetService. Tanggal transaksi adalah
 * tanggal mulai pekerjaan, atau tanggal kerusakan bila pekerjaan belum dimulai. Harga satuan
 * berasal dari valuation_rate dan nilai total dari total_value pada baris konsumsi.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_sparepart_usages');

        DB::statement(<<<'SQL'
            CREATE VIEW report_sparepart_usages AS
            SELECT
                ci.id AS id,
                svc.code AS code,
                svc.asset_id AS asset_id,
                a.asset_name AS asset_name,
                COALESCE(svc.start_date, svc.failure_date) AS transaction_date,
                ci.item_id AS item_variant_id,
                iv.code AS item_code,
                iv.item_name AS item_name,
                u.name AS unit_name,
                ci.quantity AS quantity,
                ci.valuation_rate AS unit_price,
                ci.total_value AS total_value
            FROM asset_service_consumed_items ci
            INNER JOIN asset_services svc ON svc.id = ci.asset_service_id AND svc.deleted_at IS NULL
            INNER JOIN item_variants iv ON iv.id = ci.item_id
            LEFT JOIN item_units iu ON iu.id = ci.item_unit_id
            LEFT JOIN units u ON u.id = iu.unit_id
            LEFT JOIN assets a ON a.id = svc.asset_id
            WHERE ci.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_sparepart_usages');
    }
};
