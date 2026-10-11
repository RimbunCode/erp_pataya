<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ownership Asset -> satu pasangan morph (`ownership_type` + `ownership_id`).
 *
 * Sebelum: tiga kolom FK terpisah (`ownership_company_id`, `ownership_supplier_id`,
 * `ownership_customer_id`). Sesudah: `ownership_id` menyimpan ULID Supplier/Customer
 * sesuai `ownership_type`; pemilik `company` ber-`ownership_id` NULL (sistem tidak
 * multi-company, nama perusahaan dari Preference `company_name`).
 * `ownership_type` (enum string) TIDAK berubah. Spec asset-ownership-morph.
 */
return new class extends Migration
{
    private const TYPES = ['company', 'supplier', 'customer'];

    public function up(): void {
        // Data tak dikenal tak boleh diubah diam-diam: berhenti dgn pesan jelas.
        $unknown = DB::table('assets')->whereNotIn('ownership_type', self::TYPES)->pluck('id');
        if ($unknown->isNotEmpty()) {
            throw new RuntimeException(
                'assets.ownership_type di luar [' . implode(', ', self::TYPES) . '] pada baris: ' . $unknown->implode(', '),
            );
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->ulid('ownership_id')->nullable()->after('ownership_type')->index();
        });

        DB::transaction(function () {
            DB::table('assets')->where('ownership_type', 'supplier')
                ->update(['ownership_id' => DB::raw('ownership_supplier_id')]);
            DB::table('assets')->where('ownership_type', 'customer')
                ->update(['ownership_id' => DB::raw('ownership_customer_id')]);
            // company: ownership_id tetap NULL.
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['ownership_company_id', 'ownership_supplier_id', 'ownership_customer_id']);
        });
    }

    /**
     * `ownership_company_id` tak pernah berisi data bermakna (tak ada model company):
     * dipulihkan sebagai kolom kosong -- lossy hanya untuk nilai sampah lama.
     */
    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->ulid('ownership_company_id')->nullable()->after('ownership_type');
            $table->ulid('ownership_supplier_id')->nullable()->after('ownership_company_id');
            $table->ulid('ownership_customer_id')->nullable()->after('ownership_supplier_id');
        });

        DB::transaction(function () {
            DB::table('assets')->where('ownership_type', 'supplier')
                ->update(['ownership_supplier_id' => DB::raw('ownership_id')]);
            DB::table('assets')->where('ownership_type', 'customer')
                ->update(['ownership_customer_id' => DB::raw('ownership_id')]);
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->dropIndex(['ownership_id']);
            $table->dropColumn('ownership_id');
        });
    }
};
