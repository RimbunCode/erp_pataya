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
        Schema::create('item_barcodes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('item_variant_id')->references('id')->on('item_variants')->cascadeOnDelete();
            $table->foreignUlid('unit_id')->nullable()->references('id')->on('units')->nullOnDelete();
            $table->foreignUlid('item_unit_id')->nullable()->references('id')->on('item_units')->nullOnDelete();
            $table->string('barcode');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['barcode', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('item_barcodes');
    }
};
