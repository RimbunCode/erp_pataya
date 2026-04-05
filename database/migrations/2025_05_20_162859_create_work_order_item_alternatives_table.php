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
        Schema::create('work_order_item_alternatives', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('work_order_item_id')->references('id')->on('work_order_items')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('work_order_item_alternatives');
    }
};
