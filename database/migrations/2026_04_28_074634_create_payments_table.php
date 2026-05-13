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
        Schema::create('payments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->nullable();
            $table->string('status')->default('pending');
            $table->string('proof_image')->nullable();
            $table->string('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignUlid('verified_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('payments');
    }
};
