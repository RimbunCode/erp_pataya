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
    Schema::create('sales_orders', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->nullableUlidMorphs('referenceable');
      $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
      $table->string('customer_name')->nullable();
      $table->foreignUlid('customer_branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
      $table->string('customer_branch_name')->nullable();
      $table->foreignUlid('reference_so_id')->nullable()->references('id')->on('sales_orders')->nullOnDelete();
      $table->boolean('is_rent')->default(false);
      $table->timestamp('date');
      $table->timestamp('start_date')->nullable();
      $table->timestamp('end_date')->nullable();
      $table->text('external_note')->nullable();
      $table->string('currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->string('base_currency_code')->nullable();
      $table->foreign('base_currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->double('exchange_rate')->nullable();
      $table->double('discount_amount')->default(0);
      $table->double('discount_rate')->default(0);
      $table->string('discount_on')->nullable();
      $table->double('amount')->default(0);
      $table->double('amount_base_currency')->default(0);
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('sales_orders');
  }
};
