<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_invitations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('token', 64)->unique()->index();
            $table->string('organization_name');
            $table->string('email');
            $table->string('contact_person');
            $table->text('address')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('website')->nullable();
            $table->string('industry')->nullable();
            $table->string('employee_count')->nullable();
            $table->foreignUlid('logo_file_id')->nullable()->references('id')->on('files')->nullOnDelete();
            $table->string('password')->nullable();
            $table->string('status')->default('invited');
            $table->foreignUlid('invited_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('reviewed_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->foreignUlid('user_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('expired_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_invitations');
    }
};
