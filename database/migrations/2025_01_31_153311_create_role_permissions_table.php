<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('role_permissions', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('name');
      $table->string('slug');
      $table->foreignUlid('role_id')->nullable()->references('id')->on('roles')->cascadeOnDelete();
      $table->unsignedSmallInteger('level')->default(0);
      $table->json('permissions')->nullable();
      $table->timestamps();
      $table->softDeletes();
      $table->unique(['slug', 'deleted_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('role_permissions');
  }
};
