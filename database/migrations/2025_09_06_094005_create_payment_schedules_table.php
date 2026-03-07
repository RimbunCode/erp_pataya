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
    Schema::create('payment_schedules', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('reference_to')->nullable();
      $table->ulidMorphs('payment_scheduleable', 'payment_scheduleable_index');
      $table->double('invoice_portion');
      $table->text('description')->nullable();
      $table->foreignUlid('payment_term_id')->nullable()->references('id')->on('payment_terms')->nullOnDelete();
      $table->foreignUlid('payment_method_id')->nullable()->references('id')->on('payment_methods')->nullOnDelete();
      $table->double('payment_amount');
      $table->double('paid_amount')->default(0);
      $table->double('outstanding_amount')->storedAs('payment_amount - paid_amount');
      $table->timestamp('due_date');
      $table->string('discount_type')->nullable();
      $table->double('discount')->nullable();
      $table->date('discount_date')->nullable();
      $table->boolean('for_internal');
      $table->json('logs')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('payment_schedules');
  }
};
