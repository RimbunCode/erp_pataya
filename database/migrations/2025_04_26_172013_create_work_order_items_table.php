<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('work_order_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->timestamp("date");
      $table->foreignUlid('work_order_id')->references('id')->on('work_orders')->cascadeOnDelete();
      $table->foreignUlid('item_variant_id')->nullable()->references('id')->on('item_variants')->nullOnDelete();
      $table->string('item_name')->nullable();
      $table->unsignedInteger('quantity')->default(1);
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
    Schema::dropIfExists('work_order_items');
  }
};
