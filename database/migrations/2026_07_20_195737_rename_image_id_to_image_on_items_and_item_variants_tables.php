<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::table('items', function (Blueprint $table) {
            $table->renameColumn('image_id', 'image');
        });
        Schema::table('item_variants', function (Blueprint $table) {
            $table->renameColumn('image_id', 'image');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('items', function (Blueprint $table) {
            $table->renameColumn('image', 'image_id');
        });
        Schema::table('item_variants', function (Blueprint $table) {
            $table->renameColumn('image', 'image_id');
        });
    }
};
