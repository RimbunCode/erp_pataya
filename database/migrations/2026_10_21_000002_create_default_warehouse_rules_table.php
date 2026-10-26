<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('default_warehouse_rules', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('module', 16);
            $table->string('document_type', 32)->nullable();
            $table->string('item_type')->nullable();
            $table->boolean('is_stock_item')->nullable();
            $table->foreignUlid('item_category_id')->nullable()->constrained('categories')->cascadeOnDelete();
            $table->foreignUlid('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();
            $table->index(['module', 'document_type']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('default_warehouse_rules');
    }
};
