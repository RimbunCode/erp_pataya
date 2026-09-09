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
        Schema::table('assets', function (Blueprint $table) {
            $table->boolean('is_rentable')->default(false)->after('asset_quantity');
            $table->boolean('allow_bulk_quantity')->default(false)->after('is_rentable');
        });

        // Copy per-kategori: hindari UPDATE...JOIN, tidak didukung seragam
        // oleh grammar Eloquent di MySQL & SQLite (test suite pakai SQLite :memory:).
        DB::table('asset_categories')
            ->select('id', 'is_rentable', 'allow_bulk_quantity')
            ->orderBy('id')
            ->each(function ($category) {
                DB::table('assets')
                    ->where('asset_category_id', $category->id)
                    ->update([
                        'is_rentable'         => (bool) $category->is_rentable,
                        'allow_bulk_quantity' => (bool) $category->allow_bulk_quantity,
                    ]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['is_rentable', 'allow_bulk_quantity']);
        });
    }
};
