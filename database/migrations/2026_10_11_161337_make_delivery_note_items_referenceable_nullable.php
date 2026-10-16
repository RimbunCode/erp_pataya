<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Baris Delivery Note di luar Sales Order (spec
     * delivery-note-sales-invoice-off-source-items): baris bebas tidak punya
     * sumber `referenceable`, hanya `item_id` atau `asset_id`.
     */
    public function up(): void {
        Schema::table('delivery_note_items', function (Blueprint $table) {
            $table->string('referenceable_type')->nullable()->change();
            $table->foreignUlid('referenceable_id')->nullable()->change();
        });
    }

    public function down(): void {
        if (DB::table('delivery_note_items')->whereNull('referenceable_id')->exists()) {
            throw new RuntimeException('Tidak dapat rollback: masih ada baris Delivery Note tanpa referenceable (baris di luar Sales Order).');
        }

        Schema::table('delivery_note_items', function (Blueprint $table) {
            $table->string('referenceable_type')->nullable(false)->change();
            $table->foreignUlid('referenceable_id')->nullable(false)->change();
        });
    }
};
