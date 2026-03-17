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
        Schema::create('logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->longText('activity');
            $table->string('type')->default('log');
            $table->json('data_before')->nullable();
            $table->json('data_after')->nullable();
            $table->ulidMorphs('loggable');
            $table->foreignUlid('user_id')->nullable()->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('logs');
    }
};
