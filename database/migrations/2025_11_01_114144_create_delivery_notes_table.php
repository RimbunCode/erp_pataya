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
        Schema::create('delivery_notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->timestamp('delivery_date');
            $table->foreignUlid('return_against_id')->nullable()->references('id')->on('delivery_notes');
            $table->ulidMorphs('referenceable', 'delivery_note_referenceable');
            $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
            $table->foreignUlid('customer_branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
            $table->text('external_note')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_notes');
    }
};
