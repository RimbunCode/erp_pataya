<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('item_alternatives', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('item_id')->references('id')->on('items')->cascadeOnDelete();
      $table->foreignUlid('alternative_item_id')->references('id')->on('items')->cascadeOnDelete();
      $table->boolean('two_way')->default(false);
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('item_alternatives');
  }
};
