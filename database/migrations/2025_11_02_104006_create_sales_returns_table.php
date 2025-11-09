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
    Schema::create('sales_returns', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->timestamp('return_date')->nullable();
      $table->foreignUlid('delivery_note_id')->references('id')->on('delivery_notes');
      $table->foreignUlid('sales_order_id')->nullable()->references('id')->on('sales_orders')->nullOnDelete();
      $table->string('type');
      $table->text('external_note')->nullable();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('sales_returns');
  }
};
