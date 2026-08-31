<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Requirement 4.5, spec asset-service-billing: AssetServiceConsumedItem.item_id
 * seharusnya menunjuk ItemVariant (selaras SalesOrderItem/InternalOrderItem),
 * bukan Item langsung -- sebelumnya salah wire ke tabel items, membuat auto-derive
 * ItemVariant di baris part SalesOrder/InternalOrder tidak bisa 1:1 tanpa tebak.
 */
return new class extends Migration
{
    public function up(): void {
        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->dropForeign(['item_id']);
        });

        // Backfill: baris existing nunjuk ke Item, ganti ke ItemVariant pertama
        // milik Item itu (dev data, belum ada precedent baris >1 ItemVariant per Item
        // yang perlu presisi lebih dari ini).
        DB::table('asset_service_consumed_items')->orderBy('id')->each(function ($row) {
            $itemVariant = DB::table('item_variants')->where('item_id', $row->item_id)->first();
            if ($itemVariant) {
                DB::table('asset_service_consumed_items')
                    ->where('id', $row->id)
                    ->update(['item_id' => $itemVariant->id]);
            }
        });

        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->foreign('item_id')->references('id')->on('item_variants')->restrictOnDelete();
        });
    }

    public function down(): void {
        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->dropForeign(['item_id']);
        });

        DB::table('asset_service_consumed_items')->orderBy('id')->each(function ($row) {
            $itemVariant = DB::table('item_variants')->where('id', $row->item_id)->first();
            if ($itemVariant) {
                DB::table('asset_service_consumed_items')
                    ->where('id', $row->id)
                    ->update(['item_id' => $itemVariant->item_id]);
            }
        });

        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->foreign('item_id')->references('id')->on('items')->restrictOnDelete();
        });
    }
};
