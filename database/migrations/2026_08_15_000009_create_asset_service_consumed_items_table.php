<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_service_consumed_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_service_id')->references('id')->on('asset_services')->cascadeOnDelete();
            $table->foreignUlid('item_id')->references('id')->on('items')->restrictOnDelete();
            $table->decimal('quantity', 15, 4);
            $table->decimal('valuation_rate', 15, 4);
            $table->decimal('total_value', 15, 4)->default(0);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_service_consumed_items');
    }
};
