<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('stock_attributes', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('stock_id')->references('id')->on('stocks')->cascadeOnDelete();
      $table->foreignUlid('item_attribute_id')->references('id')->on('item_attributes')->cascadeOnDelete();
      $table->string('value');
      $table->timestamps();
      $table->softDeletes();
      $table->unique(['stock_id', 'item_attribute_id', 'deleted_at'], 'stock_attribute_unique');
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('stock_attributes');
  }
};
