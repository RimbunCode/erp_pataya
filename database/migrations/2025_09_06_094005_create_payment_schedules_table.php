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
    Schema::create('payment_schedules', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('reference_to')->nullable();
      $table->ulidMorphs('payment_scheduleable', 'payment_scheduleable_index');
      $table->double('invoice_portion');
      $table->string('discount_type')->nullable();
      $table->double('discount')->nullable();
      $table->text('description')->nullable();
      $table->foreignUlid('payment_term_id')->nullable()->references('id')->on('payment_terms')->nullOnDelete();
      $table->foreignUlid('payment_method_id')->nullable()->references('id')->on('payment_methods')->nullOnDelete();
      $table->double('payment_amount');
      $table->double('paid_amount')->default(0);
      $table->double('outstanding_amount')->storedAs('payment_amount - paid_amount');
      $table->timestamp('payment_date')->nullable();
      $table->timestamp('due_date');
      $table->boolean('for_internal');
      $table->boolean('is_submitted')->default(false);
      $table->double('exchange_rate')->default(1);
      $table->string('currency_code')->nullable();
      $table->string('base_currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->double('base_payment_amount')->storedAs('payment_amount * exchange_rate');
      $table->double('base_paid_amount')->default(0);
      $table->double('base_outstanding_amount')->storedAs('base_payment_amount - base_paid_amount');
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('payment_schedules');
  }
};
