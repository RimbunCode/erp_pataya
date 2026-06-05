<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Menambahkan status baru untuk PurchaseOrder:
     * - PARTIALLY_RECEIVED
     * - RECEIVED
     * - OVER_RECEIVED
     * - PARTIALLY_BILLED
     * - BILLED
     * - OVER_BILLED
     * - COMPLETED
     *
     * Catatan: Status disimpan dalam JSON field, tidak perlu perubahan schema.
     * Migration ini hanya untuk dokumentasi dan bisa digunakan untuk seed data jika diperlukan.
     */
    public function up(): void
    {
        // Status baru akan ditambahkan melalui Enum di kode aplikasi
        // Tidak ada perubahan schema database karena status menggunakan JSON field
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Tidak ada perubahan untuk di-rollback
    }
};
