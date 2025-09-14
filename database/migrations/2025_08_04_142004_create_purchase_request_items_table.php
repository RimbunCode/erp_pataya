<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('purchase_request_items', function (Blueprint $table) {
      $table->ulid("id")->primary();
      $table->foreignUlid('purchase_request_id')->references('id')->on('purchase_requests')->cascadeOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->string('item_name')->nullable();
      $table->timestamp('required_date')->nullable();
      $table->foreignUlid('target_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->unsignedInteger('quantity')->default(1);
      $table->unsignedInteger('ordered_quantity')->default(0);
      $table->unsignedInteger('remaining_quantity')->storedAs('quantity - ordered_quantity');
      $table->foreignUlid('unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
      $table->string("unit_name")->nullable();
      $table->double('conversion_factor')->nullable()->default(1);
      $table->text("description")->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('purchase_request_items');
  }
};
