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
        Schema::create('instructor_payout_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('instructor_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('requested_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('approved_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('paid_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->decimal('requested_amount', 12, 2);
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->string('status')->default('pending');
            $table->string('source')->default('manual');
            $table->text('note')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('transfer_reference')->nullable();
            $table->string('proof_file_path')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['instructor_id', 'status'], 'instructor_payout_requests_instructor_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('instructor_payout_requests');
    }
};
