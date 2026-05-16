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
        Schema::create('submissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('content_id')->references('id')->on('course_contents')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->string('status')->default('submitted');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
            $table->unique(['user_id', 'content_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('submissions');
    }
};
