<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('tikets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->string('type'); // bug_problem, task, question, other
            $table->string('priority')->default('medium'); // low, medium, high, critical
            $table->string('subject');
            $table->longText('content')->nullable();
            $table->string('status')->default('new'); // new, in_progress, on_hold, resolved, done
            $table->tinyInteger('progress')->default(0); // 0-100
            $table->foreignUlid('assign_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('created_by_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
            $table->datetime('start_date')->nullable();
            $table->datetime('due_date')->nullable();
            $table->datetime('end_date')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('tikets');
    }
};
