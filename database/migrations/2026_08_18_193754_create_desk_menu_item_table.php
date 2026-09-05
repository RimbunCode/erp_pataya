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
        Schema::create('desk_menu_item', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('desk_id')->references('id')->on('desks')->cascadeOnDelete();
            $table->foreignUlid('menu_item_id')->references('id')->on('menu_items')->cascadeOnDelete();
            $table->unsignedInteger('order')->default(0);
            $table->string('icon')->nullable();
            $table->timestamps();
            $table->unique(['desk_id', 'menu_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('desk_menu_item');
    }
};
