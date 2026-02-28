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
    Schema::create('purchase_invoice_items', function (Blueprint $table) {
      $table->ulid("id")->primary();
      $table->foreignUlid('purchase_invoice_id')->references('id')->on('purchase_invoices')->cascadeOnDelete();
      $table->foreignUlid('purchase_order_item_id')->nullable()->references('id')->on('purchase_order_items')->nullOnDelete();
      $table->foreignUlid('return_against_item_id')->nullable()->references('id')->on('purchase_invoice_items')->nullOnDelete();
      $table->nullableUlidMorphs('referenceable');
      $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
      $table->string('item_name')->nullable();
      $table->double('quantity')->default(1);
      $table->double('returned_quantity')->default(0);
      $table->double('unreturned_quantity')->storedAs('quantity - returned_quantity');
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
    Schema::dropIfExists('purchase_invoice_items');
  }
};
