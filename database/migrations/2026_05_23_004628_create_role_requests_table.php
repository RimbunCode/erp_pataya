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
        Schema::create('role_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('requested_role');
            $table->text('reason');
            $table->foreignUlid('proof_file_id')->references('id')->on('files');
            $table->string('status')->default('pending');
            $table->foreignUlid('reviewed_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->index(['user_id', 'requested_role', 'status'], 'role_requests_user_role_status_idx');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('role_requests');
    }
};
