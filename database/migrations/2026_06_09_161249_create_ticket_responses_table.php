<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('ticket_responses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('ticket_id')->references('id')->on('tickets')->cascadeOnDelete();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('assign_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->string('type');
            $table->string('priority')->default('medium');
            $table->string('subject');
            $table->string('status');
            $table->tinyInteger('progress')->default(0);
            $table->datetime('start_date')->nullable();
            $table->datetime('due_date')->nullable();
            $table->longText('content')->nullable();
            $table->longText('content_json')->nullable();
            $table->datetime('end_date')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('ticket_responses');
    }
};
