<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('code');
      $table->string('name');
      $table->text('description')->nullable();
      $table->foreignUlid('category_id')->nullable()->references('id')->on('categories')->nullOnDelete();
      $table->foreignUlid('default_unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
      $table->unsignedInteger('stock_minimum')->default(0);
      $table->foreignUlid('image_id')->nullable()->references('id')->on('files')->nullOnDelete();
      $table->boolean('is_disabled')->default(false);
      $table->timestamps();
      $table->softDeletes();
      $table->unique(['code', 'deleted_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('items');
  }
};
