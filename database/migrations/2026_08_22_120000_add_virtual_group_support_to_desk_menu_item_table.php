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
        Schema::table('desk_menu_item', function (Blueprint $table) {
            $table->foreignUlid('menu_item_id')->nullable()->change();
            $table->string('label')->nullable()->after('menu_item_id');
            $table->foreignUlid('parent_id')->nullable()->after('label')
                ->references('id')->on('desk_menu_item')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('desk_menu_item', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'label']);
            $table->foreignUlid('menu_item_id')->nullable(false)->change();
        });
    }
};
