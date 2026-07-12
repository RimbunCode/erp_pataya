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
        Schema::create('quotation_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('quotation_id')->references('id')->on('quotations')->cascadeOnDelete();
            $table->foreignUlid('item_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->text('description')->nullable();
            $table->double('quantity')->default(0);
            $table->double('price')->default(0);
            $table->double('amount')->storedAs('quantity * price');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('quotation_items');
    }
};
