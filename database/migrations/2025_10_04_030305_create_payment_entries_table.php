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
    Schema::create('payment_entries', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('code')->unique();
      $table->timestamp('date');
      $table->string('payment_type');
      $table->ulidMorphs('paymentable');
      $table->ulidMorphs('partyable');
      $table->double('paid_amount')->default(0);
      $table->double('based_paid_amount')->default(0);
      $table->double('exchange_rate')->default(0);
      $table->string('currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->string('base_currency_code')->nullable();
      $table->foreignUlid('payment_method_id')->nullable()->references('id')->on('payment_methods')->nullOnDelete();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('payment_entries');
  }
};
