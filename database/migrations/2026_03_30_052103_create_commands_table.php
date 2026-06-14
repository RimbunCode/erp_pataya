<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::create('commands', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('signature')->unique();
            $table->enum('type', ['navigation', 'record']);
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('search_text')->nullable();
            $table->string('route_name')->nullable();
            $table->json('route_params')->nullable();
            $table->string('target_model_type')->nullable();
            $table->string('target_model_id')->nullable();
            $table->string('source_model_type')->nullable();
            $table->string('source_model_id')->nullable();
            $table->foreignUlid('owner_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('type');
            $table->index('route_name');
            $table->index(['target_model_type', 'target_model_id']);
            $table->index(['source_model_type', 'source_model_id']);
            $table->index('owner_id');
            if (DB::getDriverName() !== 'sqlite') {
                $table->fullText(['title', 'subtitle', 'search_text'], 'commands_fulltext_search');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('commands');
    }
};
