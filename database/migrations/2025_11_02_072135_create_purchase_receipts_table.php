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
    Schema::create('purchase_receipts', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->timestamp('date');
      $table->foreignUlid('return_against_id')->nullable()->references('id')->on('purchase_receipts')->cascadeOnDelete();
      $table->foreignUlid('purchase_order_id')->nullable()->references('id')->on('purchase_orders')->nullOnDelete();
      $table->foreignUlid('supplier_id')->nullable()->references('id')->on('suppliers')->nullOnDelete();
      $table->text('external_note')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('purchase_receipts');
  }
};
