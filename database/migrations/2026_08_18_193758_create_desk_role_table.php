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
        Schema::create('desk_role', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('desk_id')->references('id')->on('desks')->cascadeOnDelete();
            $table->foreignUlid('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['desk_id', 'role_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('desk_role');
    }
};
