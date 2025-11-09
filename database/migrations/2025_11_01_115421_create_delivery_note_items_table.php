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
    Schema::create('delivery_note_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->ulidMorphs('referenceable');
      $table->foreignUlid('source_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->foreignUlid('delivery_note_id')->references('id')->on('delivery_notes')->cascadeOnDelete();
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->foreignUlid('unit_id')->references('id')->on('units')->cascadeOnDelete();
      $table->double('conversion_factor')->default(1);
      $table->double('quantity')->default(0);
      $table->double('returned_quantity')->default(0);
      $table->double('remaining_quantity')->storedAs('quantity - returned_quantity');
      $table->text('description')->nullable();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('delivery_note_items');
  }
};
