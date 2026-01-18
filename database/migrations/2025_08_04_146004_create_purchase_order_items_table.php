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
    Schema::create('purchase_order_items', function (Blueprint $table) {
      $table->ulid("id")->primary();
      $table->foreignUlid('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->string('item_name')->nullable();
      $table->timestamp('required_date')->nullable();
      $table->foreignUlid('target_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->double('quantity')->default(1);
      $table->double('received_quantity')->default(0);
      $table->double('remaining_quantity')->storedAs('quantity - received_quantity');
      $table->foreignUlid('unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
      $table->string("unit_name")->nullable();
      $table->double('conversion_factor')->default(1);
      $table->text("description")->nullable();
      $table->foreignUlid('tax_id')->nullable()->references('id')->on('taxes')->nullOnDelete();
      $table->double('tax_rate')->default(0);
      $table->double('basic_amount')->storedAs('quantity * rate');
      $table->double('tax_amount')->storedAs('basic_amount * tax_rate / 100');
      $table->double('amount')->storedAs('basic_amount + tax_amount');
      $table->double("rate")->default(0);
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('purchase_order_items');
  }
};
