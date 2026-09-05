<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->dropForeign(['widget_id']);
            $table->dropColumn('widget_id');

            $table->foreignUlid('number_card_id')->nullable()->after('parent_id')->references('id')->on('number_cards')->nullOnDelete();
            $table->foreignUlid('chart_id')->nullable()->after('number_card_id')->references('id')->on('charts')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->dropForeign(['number_card_id']);
            $table->dropForeign(['chart_id']);
            $table->dropColumn(['number_card_id', 'chart_id']);

            $table->foreignUlid('widget_id')->nullable()->references('id')->on('widgets')->nullOnDelete();
        });
    }
};
