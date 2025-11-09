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
    Schema::create('accounts', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('account_name');
      $table->string('account_number');
      $table->foreignUlid('parent_account_id')->nullable()->references('id')->on('accounts')->nullOnDelete();
      $table->boolean('is_group')->default(false);
      $table->string('root_type');
      $table->string('report_type');
      $table->string('balance_type')->nullable();
      $table->string('account_type')->nullable();
      $table->string('currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->double('tax_rate')->default(0);
      $table->boolean('is_disabled')->default(false);
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('accounts');
  }
};
