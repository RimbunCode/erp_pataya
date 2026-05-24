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
        Schema::create('course_publish_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreignUlid('requested_by')->references('id')->on('users')->cascadeOnDelete();
            $table->string('status')->default('pending');
            $table->foreignUlid('reviewed_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->decimal('submitted_price', 12, 2)->default(0);
            $table->decimal('submitted_discount', 12, 2)->default(0);
            $table->string('submitted_discount_type')->default('percentage');
            $table->index(['course_id', 'status'], 'course_publish_requests_course_status_idx');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('course_publish_requests');
    }
};
