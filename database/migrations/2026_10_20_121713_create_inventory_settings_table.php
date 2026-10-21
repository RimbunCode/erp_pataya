<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('inventory_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->foreignUlid('default_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('inventory_settings');
    }
};
