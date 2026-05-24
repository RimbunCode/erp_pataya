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
        Schema::create('enrollments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreignUlid('payment_id')->nullable()->references('id')->on('payments')->nullOnDelete();
            $table->string('status')->default('active');
            $table->timestamp('enrolled_at')->useCurrent();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('enrollments');
    }
};
