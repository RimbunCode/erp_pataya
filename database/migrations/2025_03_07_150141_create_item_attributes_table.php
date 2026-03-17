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
        Schema::create('item_attributes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('item_id')->references('id')->on('items')->cascadeOnDelete();
            $table->foreignUlid('attribute_id')->references('id')->on('attributes')->cascadeOnDelete();
            $table->json('values');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['item_id', 'attribute_id', 'deleted_at'], 'item_attribute_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('item_attributes');
    }
};
