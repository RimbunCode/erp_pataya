<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('enrollment_evaluations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('enrollment_id')->unique()->references('id')->on('enrollments')->cascadeOnDelete();
            $table->decimal('final_score', 5, 2)->nullable();
            $table->string('grade', 1)->nullable();
            $table->boolean('is_passed')->default(false);
            $table->string('status')->default('draft');
            $table->foreignUlid('submitted_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUlid('finalized_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable();
            $table->index(['status'], 'enrollment_evaluations_status_idx');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('enrollment_evaluations');
    }
};
