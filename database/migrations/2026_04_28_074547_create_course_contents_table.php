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
            $table->foreignUlid('section_id')->constrained('course_sections')->cascadeOnDelete();
            $table->string('title');
            $table->string('type'); // pretest, material, assignment
            $table->longText('content')->nullable();
            $table->integer('order')->default(0);
            $table->boolean('is_required')->default(false);
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
