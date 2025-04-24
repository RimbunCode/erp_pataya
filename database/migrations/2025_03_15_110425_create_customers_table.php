<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  /**
   * Run the migrations.
   */
  public function up(): void
  {
    Schema::create('customers', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('name');
      $table->string('email');
      $table->boolean('is_internal')->default(false);
      $table->string('phone');
      $table->string('vat');
      $table->boolean('is_disabled')->default(false);
      $table->string('street');
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('customers');
  }
};
