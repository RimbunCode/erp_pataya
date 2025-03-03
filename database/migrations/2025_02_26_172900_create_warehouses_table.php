<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('warehouses', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('branch_id')->references('id')->on('branches')->cascadeOnDelete();
      $table->string('name');
      $table->string('code');
      $table->foreignUlid('user_id')->nullable()->references('id')->on('users')->nullOnDelete();
      $table->timestamps();
      $table->softDeletes();
      $table->unique(['code', 'deleted_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('warehouses');
  }
};
