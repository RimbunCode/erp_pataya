<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('gdoc_template_id');
            $table->foreignUlid('course_id')->nullable()->references('id')->on('courses')->nullOnDelete();
            $table->json('placeholders')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignUlid('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('certificate_templates');
    }
};
