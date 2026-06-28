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
        Schema::create('changelog_reads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('changelog_id')->references('id')->on('changelogs')->cascadeOnDelete();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamp('read_at');
            $table->timestamps();
            $table->unique(['changelog_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('changelog_reads');
    }
};
