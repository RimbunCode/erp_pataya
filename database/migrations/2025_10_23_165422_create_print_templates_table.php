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
    Schema::create('print_templates', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('name')->unique();
      $table->foreignUlid('permission_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
      $table->string('name_model')->nullable();
      $table->string('model');
      $table->longText('html')->nullable();
      $table->longText('css')->nullable();
      $table->json('template')->nullable();
      $table->boolean('is_default')->default(false);
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('prints');
  }
};
