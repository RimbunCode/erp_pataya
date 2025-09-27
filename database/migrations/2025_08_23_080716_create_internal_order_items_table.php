<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  /**
   * Run the migrations.
   */
  public function up(): void
  {
    Schema::create('internal_order_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('internal_order_id')->references('id')->on('internal_orders');
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->foreignUlid('unit_id')->references('id')->on('units')->cascadeOnDelete();
      $table->foreignUlid('source_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->double('conversion_factor')->default(1);
      $table->double('quantity')->default(0);
      $table->double('ordered_quantity')->default(0);
      $table->double('remaining_quantity')->storedAs('quantity - ordered_quantity');
      $table->text('description')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('internal_order_items');
  }
};
