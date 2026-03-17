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
        Schema::create('item_variant_attributes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->foreignUlid('attribute_id')->nullable()->references('id')->on('attributes')->nullOnDelete();
            $table->string('attribute_name');
            $table->string('value');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('stock_attributes');
    }
};
