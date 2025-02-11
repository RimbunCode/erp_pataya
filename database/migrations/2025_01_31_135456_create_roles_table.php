<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('roles', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('name');
      $table->string('slug');
      $table->string('default_home')->nullable();
      $table->boolean('is_disabled')->default(false);
      $table->timestamps();
      $table->softDeletes();
      $table->unique(['slug', 'deleted_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('roles');
  }
};
