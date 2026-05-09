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
        Schema::create('courses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->string('thumbnail')->nullable();
            $table->boolean('is_published')->default(false);
            $table->string('level')->nullable();
            $table->string('language')->default('id');
            $table->string('certificate_type')->nullable();
            $table->integer('total_hours')->default(0);
            $table->integer('total_sessions')->default(0);
            $table->foreignUlid('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('courses');
    }
};
