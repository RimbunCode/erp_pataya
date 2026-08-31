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
        Schema::create('desk_assignables', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('desk_id')->references('id')->on('desks')->cascadeOnDelete();
            $table->string('assignable_type');
            $table->ulid('assignable_id');
            $table->timestamps();

            $table->unique(['desk_id', 'assignable_type', 'assignable_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('desk_assignables');
    }
};
