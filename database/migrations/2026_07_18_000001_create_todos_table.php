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
        Schema::create('todos', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->nullableUlidMorphs('reference');
            $table->ulid('allocated_to_id'); // FK ke assignables.id (view) — tanpa constraint fisik, target bukan tabel
            $table->string('allocated_to_type'); // 'user' | 'role' — cache dari Assignable.type
            $table->foreignUlid('assigned_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->text('description')->nullable();
            $table->string('priority')->default('medium'); // low, medium, high
            $table->string('status')->default('open'); // open, closed, canceled
            $table->date('date')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at'], 'todos_reference_assignee_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('todos');
    }
};
