<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('delivery_note_item_assets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('delivery_note_item_id')->references('id')->on('delivery_note_items')->cascadeOnDelete();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->decimal('quantity', 15, 4);
            $table->timestamp('processed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('delivery_note_item_assets');
    }
};
