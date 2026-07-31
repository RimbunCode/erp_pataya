<?php

use App\Enums\TodoType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->string('type')->default(TodoType::TASK->value)->after('allocated_to_type');
            $table->json('reminder_lead_days')->nullable()->after('due_date');
            $table->index(['status', 'due_date'], 'todos_status_due_date_index');
        });

        DB::table('todos')->whereNull('type')->update(['type' => TodoType::TASK->value]);
    }

    public function down(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->dropIndex('todos_status_due_date_index');
            $table->dropColumn(['type', 'reminder_lead_days']);
        });
    }
};
