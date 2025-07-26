<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('item_reserveds', function (Blueprint $table) {
      $table->ulid("id")->primary();
      $table->nullableUlidMorphs('reserveable');
      $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->onDelete('cascade');
      $table->foreignUlid('stock_id')->references('id')->on('stocks')->onDelete('cascade');
      $table->unsignedInteger('quantity')->default(0);
      $table->foreignUlid('unit_id')->references('id')->on('units')->onDelete('cascade');
      $table->string('status')->default('reserved'); // reserved, cancelled, completed
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('item_reserveds');
  }
};
