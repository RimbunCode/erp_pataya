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
    Schema::create('additional_costs', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('expense_account_id')->references('id')->on('accounts')->cascadeOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->string('purpose');
      $table->double('amount');
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('additional_costs');
  }
};
