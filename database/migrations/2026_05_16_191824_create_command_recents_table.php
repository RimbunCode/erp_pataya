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
        Schema::create('command_recents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('recent_key');
            $table->string('signature')->nullable();
            $table->enum('type', ['navigation', 'record'])->nullable();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('route_name')->nullable();
            $table->json('route_params')->nullable();
            $table->string('target_model_type')->nullable();
            $table->string('target_model_id')->nullable();
            $table->string('source_model_type')->nullable();
            $table->string('source_model_id')->nullable();
            $table->json('payload')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['user_id', 'recent_key']);
            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
            $table->index('signature');
            $table->index('route_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('command_recents');
    }
};
