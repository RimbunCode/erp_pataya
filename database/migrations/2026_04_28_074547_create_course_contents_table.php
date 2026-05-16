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
        Schema::create('course_contents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('section_id')->references('id')->on('course_sections')->cascadeOnDelete();
            $table->string('title');
            $table->string('type');
            $table->text('description')->nullable();
            $table->dateTime('deadline')->nullable(); // untuk assignment
            $table->boolean('is_optional')->default(false); // untuk pre_assessment
            $table->boolean('is_required')->default(true);
            $table->integer('order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('course_contents');
    }
};
