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
    Schema::create('items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('code');
      $table->string('name');
      $table->text('description')->nullable();
      $table->foreignUlid('category_id')->nullable()->references('id')->on('categories')->nullOnDelete();
      $table->foreignUlid('default_unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
      $table->double('conversion_factor')->nullable()->default(1);
      $table->unsignedInteger('stock_minimum')->default(0);
      $table->foreignUlid('image_id')->nullable()->references('id')->on('files')->nullOnDelete();
      $table->boolean('is_disabled')->default(false);
      $table->boolean('allow_alternative_item')->default(false);
      $table->boolean('is_stock_item')->default(true);
      $table->string('type');
      $table->string('format_variant')->nullable();
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
