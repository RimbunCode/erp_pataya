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
    Schema::create('purchase_return_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('purchase_return_id')->references('id')->on('purchase_returns')->cascadeOnDelete();
      $table->foreignUlid('purchase_receipt_item_id')->nullable()->references('id')->on('purchase_receipt_items')->nullOnDelete();
      $table->foreignUlid('source_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->foreignUlid('unit_id')->references('id')->on('units')->cascadeOnDelete();
      $table->double('rate')->default(0);
      $table->double('conversion_factor')->default(1);
      $table->double('quantity')->default(0);
      $table->text('description')->nullable();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('purchase_return_items');
  }
};
