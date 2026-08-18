<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->foreignUlid('item_unit_id')->nullable()->after('item_id')
                ->references('id')->on('item_units')->restrictOnDelete();
        });

        // Backfill: replikasi App\Models\Inventory\Item::defaultUom() secara manual
        // (item_units.unit_id = items.default_unit_id) karena migration tidak
        // boleh bergantung pada model app yang bisa berubah bentuk.
        DB::table('asset_service_consumed_items')
            ->whereNull('item_unit_id')
            ->orderBy('id')
            ->each(function ($row) {
                $item = DB::table('items')->find($row->item_id);
                if (! $item || ! $item->default_unit_id) {
                    return;
                }

                $defaultUomId = DB::table('item_units')
                    ->where('item_id', $item->id)
                    ->where('unit_id', $item->default_unit_id)
                    ->value('id');

                if ($defaultUomId) {
                    DB::table('asset_service_consumed_items')
                        ->where('id', $row->id)
                        ->update(['item_unit_id' => $defaultUomId]);
                }
            });

        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->foreignUlid('item_unit_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('asset_service_consumed_items', function (Blueprint $table) {
            $table->dropForeign(['item_unit_id']);
            $table->dropColumn('item_unit_id');
        });
    }
};
