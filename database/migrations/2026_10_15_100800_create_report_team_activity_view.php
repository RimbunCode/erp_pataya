<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sumber tabel Laporan Anggota Tim (spec modul-laporan, Req 16).
 *
 * Satu baris per aktivitas servis. PIC bisa kosong: LEFT JOIN users menjaga aktivitas tanpa
 * PIC tetap tampil (Req 16.5), dan labelnya diterjemahkan di model.
 */
return new class extends Migration
{
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS report_team_activities');

        DB::statement(<<<'SQL'
            CREATE VIEW report_team_activities AS
            SELECT
                act.id AS id,
                svc.code AS code,
                svc.id AS asset_service_id,
                svc.asset_id AS asset_id,
                a.asset_name AS asset_name,
                act.action_date AS transaction_date,
                act.pic_id AS pic_id,
                u.name AS pic_name,
                act.status AS activity_status,
                act.description AS description
            FROM asset_service_activities act
            INNER JOIN asset_services svc ON svc.id = act.asset_service_id AND svc.deleted_at IS NULL
            LEFT JOIN users u ON u.id = act.pic_id
            LEFT JOIN assets a ON a.id = svc.asset_id
            WHERE act.deleted_at IS NULL
            SQL);
    }

    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS report_team_activities');
    }
};
