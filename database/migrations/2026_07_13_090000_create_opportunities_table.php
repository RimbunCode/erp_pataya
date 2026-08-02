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
        Schema::create('opportunities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('lead_id')->nullable()->references('id')->on('leads')->nullOnDelete();
            $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
            $table->string('title');
            $table->string('stage')->default('identified');
            $table->double('expected_value')->default(0);
            $table->unsignedTinyInteger('probability')->default(0);
            $table->date('expected_close_date')->nullable();
            $table->foreignUlid('assigned_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('opportunities');
    }
};
