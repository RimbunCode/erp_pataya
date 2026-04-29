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
        Schema::create('course_category', function (Blueprint $table) {
            $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreignUlid('category_id')->references('id')->on('categories')->cascadeOnDelete();
            $table->primary(['course_id', 'category_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('course_category');
    }
};
