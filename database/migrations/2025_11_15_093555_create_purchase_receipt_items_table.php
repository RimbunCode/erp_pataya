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
        Schema::create('purchase_receipt_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('purchase_receipt_id')->references('id')->on('purchase_receipts')->cascadeOnDelete();
            $table->foreignUlid('purchase_order_item_id')->nullable()->references('id', 'purchase_order_index')->on('purchase_order_items')->nullOnDelete();
            $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->string('item_name')->nullable();
            $table->foreignUlid('unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
            $table->string('unit_name')->nullable();
            $table->double('conversion_factor')->default(1);
            $table->foreignUlid('target_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
            $table->text('description')->nullable();
            $table->double('quantity')->default(1);
            $table->double('returned_quantity')->default(0);
            $table->double('unreturned_quantity')->storedAs('quantity - returned_quantity');
            $table->foreignUlid('return_against_item_id')->nullable()->references('id')->on('purchase_receipt_items')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('purchase_receipt_items');
    }
};
