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
        Schema::create('stock_ledger_entries', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->UlidMorphs('referenceable');
            $table->foreignUlid('item_id')->references('id')->on('item_variants');
            $table->foreignUlid('warehouse_id')->references('id')->on('warehouses');
            $table->foreignUlid('item_unit_id')->references('id')->on('item_units');
            $table->double('conversion_factor')->default(1);
            $table->double('quantity_change')->default(0);
            $table->double('quantity_after_transaction')->default(0);
            $table->double('valuation_rate')->default(0);
            $table->double('balance_stock_value')->default(0);
            $table->double('change_in_stock_value')->default(0);
            $table->boolean('is_valuated')->default(false);
            $table->json('stock_queue')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('stock_ledger_entries');
    }
};
