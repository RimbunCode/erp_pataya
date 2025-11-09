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
    Schema::create('sales_invoices', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->timestamp('date');
      $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
      $table->string('customer_name')->nullable();
      $table->foreignUlid('customer_branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
      $table->string('customer_branch_name')->nullable();
      $table->foreignUlid('sales_order_id')->nullable()->references('id')->on('sales_orders')->nullOnDelete();
      $table->double('base_amount')->default(0);
      $table->double('amount')->default(0);
      $table->double('base_paid_amount')->default(0);
      $table->double('base_outstanding_amount')->storedAs('base_amount - base_paid_amount');
      $table->double('discount_amount')->default(0);
      $table->double('discount_rate')->default(0);
      $table->string('discount_on')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->string('currency_code')->nullable();
      $table->foreign('base_currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->string('base_currency_code')->nullable();
      $table->double('exchange_rate')->nullable();
      $table->text('external_note')->nullable();
      $table->string('status')->default('draft');
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('sales_invoices');
  }
};
