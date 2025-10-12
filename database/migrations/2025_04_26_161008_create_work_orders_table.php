<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('work_orders', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
      $table->string('customer_name')->nullable();
      $table->foreignUlid('customer_branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
      $table->string('customer_branch_name')->nullable();
      $table->foreignUlid('item_service_id')->nullable()->references('id')->on('item_variants')->nullOnDelete();
      $table->string('item_service_name')->nullable();
      $table->timestamp('date')->nullable();
      $table->text('external_note')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('work_orders');
  }
};
