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
        Schema::create('stocks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->foreignUlid('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
            $table->foreignUlid('unit_id')->references('id')->on('units')->restrictOnDelete();
            $table->double('quantity')->default(0);
            $table->double('reserved_quantity')->default(0);
            $table->double('incoming_quantity')->default(0);
            $table->double('rented_quantity')->default(0);
            $table->double('actual_quantity')->storedAs('quantity - rented_quantity');
            $table->double('ready_quantity')->storedAs('actual_quantity - reserved_quantity');
            $table->double('projected_quantity')->storedAs('quantity + incoming_quantity - reserved_quantity');
            $table->double('conversion_factor');
            $table->double('valuation_rate')->default(0);
            $table->json('stock_queue')->nullable();
            $table->json('details')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};
