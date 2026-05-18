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
        Schema::create('stock_entry_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('stock_entry_id')->references('id')->on('stock_entries')->cascadeOnDelete();
            $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->foreignUlid('source_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
            $table->foreignUlid('target_warehouse_id')->nullable()->references('id')->on('warehouses')->nullOnDelete();
            $table->double('quantity')->default(0);
            $table->foreignUlid('item_unit_id')->nullable()->references('id')->on('item_units')->nullOnDelete();
            $table->double('conversion_factor')->default(1);
            $table->text('description')->nullable();
            $table->double('basic_rate')->default(0);
            $table->double('additional_cost')->default(0);
            $table->double('valuation_rate')->default(0);
            $table->double('basic_amount')->storedAs('basic_rate * quantity');
            $table->double('amount')->storedAs('basic_amount + additional_cost');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('stock_entry_items');
    }
};
