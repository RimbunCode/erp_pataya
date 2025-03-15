<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('stocks',  function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->foreignUlid('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
      $table->foreignUlid('unit_id')->references('id')->on('units')->restrictOnDelete();
      $table->unsignedInteger('quantity')->default(0);
      $table->double('price')->default(0);
      $table->double('sale_price')->default(0);
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('stocks');
  }
};
