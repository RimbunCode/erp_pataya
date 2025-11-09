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
    Schema::create('sales_order_items', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->foreignUlid('sales_order_id')->references('id')->on('sales_orders')->cascadeOnDelete();
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->foreignUlid('unit_id')->references('id')->on('units')->cascadeOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->foreignUlid('source_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
      $table->double('quantity')->default(0);
      $table->double('delivered_quantity')->default(0);
      $table->double('remaining_quantity')->storedAs('quantity - delivered_quantity');
      $table->double('price')->default(0);
      $table->double('price_base_currency')->default(0);
      $table->text('description')->nullable();
      $table->foreignUlid('tax_id')->nullable()->references('id', )->on('taxes')->nullOnDelete();
      $table->double('conversion_factor')->default(1);
      $table->double('tax_rate')->default(0);
      $table->string('currency_code')->nullable();
      $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->string('base_currency_code')->nullable();
      $table->foreign('base_currency_code')->references('code')->on('currencies')->nullOnDelete();
      $table->double('exchange_rate')->nullable();
      $table->double('basic_amount')->storedAs('quantity * price');
      $table->double('tax_amount')->storedAs('basic_amount * tax_rate / 100');
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('sales_order_items');
  }
};
