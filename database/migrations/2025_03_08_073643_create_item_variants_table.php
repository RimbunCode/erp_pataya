<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('item_variants', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string("code")->unique();
      $table->foreignUlid('item_id')->references('id')->on('items')->cascadeOnDelete();
      $table->foreignUlid('category_id')->nullable()->references('id')->on('categories')->nullOnDelete();
      $table->foreignUlid('default_unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
      $table->string('item_code');
      $table->string('item_name');
      $table->string('format_variant')->nullable();
      $table->text('description')->nullable();
      $table->boolean('is_disabled')->nullable();
      $table->boolean('allow_alternative_item')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('item_variants');
  }
};
