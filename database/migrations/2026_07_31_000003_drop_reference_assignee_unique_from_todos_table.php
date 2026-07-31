<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->dropUnique('todos_reference_assignee_unique');
            $table->index(['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at'], 'todos_reference_assignee_index');
        });
    }

    public function down(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->dropIndex('todos_reference_assignee_index');
            $table->unique(['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at'], 'todos_reference_assignee_unique');
        });
    }
};
