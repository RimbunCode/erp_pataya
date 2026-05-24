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
        Schema::create('instructor_earnings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('instructor_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('payment_id')->nullable()->references('id')->on('payments')->nullOnDelete();
            $table->foreignUlid('course_id')->nullable()->references('id')->on('courses')->nullOnDelete();
            $table->decimal('gross_amount', 12, 2);
            $table->decimal('company_amount', 12, 2)->default(0);
            $table->decimal('instructor_amount', 12, 2);
            $table->timestamp('available_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['payment_id', 'deleted_at'], 'instructor_earnings_payment_unique');
            $table->index(['instructor_id', 'available_at'], 'instructor_earnings_instructor_available_at_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('instructor_earnings');
    }
};
