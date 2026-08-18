<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_movement_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_movement_id')->references('id')->on('asset_movements')->cascadeOnDelete();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->foreignUlid('source_location_id')->nullable()->references('id')->on('asset_locations')->nullOnDelete();
            $table->foreignUlid('target_location_id')->nullable()->references('id')->on('asset_locations')->nullOnDelete();
            $table->foreignUlid('from_custodian_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('to_custodian_id')->nullable()->references('id')->on('users')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_movement_items');
    }
};
