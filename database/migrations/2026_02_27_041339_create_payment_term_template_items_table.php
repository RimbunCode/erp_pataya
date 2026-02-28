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
    Schema::create('payment_term_template_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('due_date_based_on');
      $table->unsignedTinyInteger('credit_period')->default(0);
      $table->double('invoice_portion');
      $table->string('discount_type')->nullable();
      $table->double('discount')->nullable();
      $table->text('description')->nullable();
      $table->foreignUlid('payment_method_id')->nullable()->references('id')->on('payment_methods')->nullOnDelete();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('payment_term_template_items');
  }
};
