<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('certificates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('enrollment_id')->unique()->references('id')->on('enrollments')->cascadeOnDelete();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreignUlid('certificate_template_id')->nullable()->references('id')->on('certificate_templates')->nullOnDelete();
            $table->string('credential_id')->unique();
            $table->timestamp('issued_at');
            $table->timestamp('expires_at')->nullable();
            $table->string('gdrive_file_id')->nullable();
            $table->string('gdrive_view_url', 500)->nullable();
            $table->string('gdrive_download_url', 500)->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('certificates');
    }
};
