<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `is_example` dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 1.7).
     */
    public function up(): void {
        Schema::create('fiscal_periods', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('fiscal_year_id')->references('id')->on('fiscal_years')->restrictOnDelete();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 16)->default('open');
            $table->timestamp('closed_at')->nullable();
            $table->foreignUlid('closed_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);

            $table->unique(['fiscal_year_id', 'name']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('fiscal_periods');
    }
};
