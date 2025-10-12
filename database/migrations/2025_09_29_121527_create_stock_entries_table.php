<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('stock_entries', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->nullableUlidMorphs('referenceable');
      $table->timestamp('date');
      $table->timestamp('received_date')->nullable();
      $table->boolean('using_transit')->default(false);
      $table->string('type');
      $table->text('notes')->nullable();
      $table->double('total_outgoing_value')->default(0);
      $table->double('total_incoming_value')->default(0);
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('stock_entries');
  }
};
