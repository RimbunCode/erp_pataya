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
    Schema::create('purchase_orders', function (Blueprint $table) {
      $table->ulid("id")->primary();
      $table->string("code")->unique();
      $table->timestamp('date');
      $table->timestamp('required_date')->nullable();
      $table->foreignUlid('supplier_id')->nullable()->references('id')->on('suppliers')->nullOnDelete();
      $table->string('supplier_name')->nullable();
      $table->string('currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->double('exchange_rate')->nullable();
      $table->string('base_currency_code')->nullable();
      $table->foreign('base_currency_code')->nullable()->references('code')->on('currencies')->nullOnDelete();
      $table->double('total_amount')->default(0);
      $table->double('total_amount_base_currency')->default(0);
      $table->double('discount_amount')->default(0);
      $table->double('discount_rate')->default(0);
      $table->string('discount_on')->nullable();
      $table->text("external_note")->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('purchase_orders');
  }
};
