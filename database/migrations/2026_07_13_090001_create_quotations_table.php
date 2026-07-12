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
        Schema::create('quotations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->nullableUlidMorphs('referenceable');
            $table->foreignUlid('opportunity_id')->nullable()->references('id')->on('opportunities')->nullOnDelete();
            $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
            $table->timestamp('date');
            $table->date('valid_until')->nullable();
            $table->double('amount')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('quotations');
    }
};
