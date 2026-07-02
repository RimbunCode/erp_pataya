<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('enrollment_certificate_uploads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('enrollment_id')->unique()->references('id')->on('enrollments')->cascadeOnDelete();
            $table->foreignUlid('file_id')->references('id')->on('files')->cascadeOnDelete();
            $table->foreignUlid('uploaded_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('uploaded_at');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('enrollment_certificate_uploads');
    }
};
