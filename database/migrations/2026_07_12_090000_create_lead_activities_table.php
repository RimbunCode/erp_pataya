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
        Schema::create('lead_activities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('lead_id')->references('id')->on('leads')->cascadeOnDelete();
            $table->string('type')->default('task');
            $table->string('subject');
            $table->text('description')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->string('status')->default('open');
            $table->foreignUlid('assigned_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('lead_activities');
    }
};
