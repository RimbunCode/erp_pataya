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
        Schema::create('course_notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->string('title');
            $table->text('message');
            $table->string('type');
            $table->boolean('is_urgent')->default(false);
            $table->foreignUlid('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('course_notes');
    }
};
