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
        Schema::create('saved_filters', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('model')->index();
            $table->string('name')->nullable();
            $table->boolean('is_saved')->default(false);
            $table->json('filter');
            $table->timestamps();

            $table->index(['user_id', 'model']);
            $table->index(['is_saved', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('saved_filters');
    }
};
