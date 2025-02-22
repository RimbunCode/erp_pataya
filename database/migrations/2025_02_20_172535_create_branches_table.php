<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('branches', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('name');
      $table->nullableUlidMorphs('branchable');
      $table->boolean('is_main_branch')->default(false);
      $table->boolean('is_disabled')->default(false);
      $table->string('email')->nullable();
      $table->string('phone')->nullable();
      $table->text('billing_street')->nullable();
      $table->text('billing_city')->nullable();
      $table->text('billing_state')->nullable();
      $table->text('billing_zip')->nullable();
      $table->text('billing_country')->nullable();
      $table->text('shipping_street')->nullable();
      $table->text('shipping_city')->nullable();
      $table->text('shipping_state')->nullable();
      $table->text('shipping_zip')->nullable();
      $table->text('shipping_country')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('branches');
  }
};
