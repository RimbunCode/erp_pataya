<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('todo_reminders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('todo_id')->constrained('todos')->cascadeOnDelete();
            $table->string('stage');
            // Lead: +x (H-x). DayOf: 0. Overdue: -n (urutan ke-n).
            $table->integer('offset_days');
            $table->dateTime('due_date_snapshot');
            $table->dateTime('sent_at');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->timestamps();

            $table->unique(['todo_id', 'stage', 'offset_days', 'due_date_snapshot'], 'todo_reminders_unique');
            $table->index(['todo_id', 'stage'], 'todo_reminders_todo_stage_index');
        });
    }

    public function down(): void {
        Schema::dropIfExists('todo_reminders');
    }
};
