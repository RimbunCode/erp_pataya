<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_services', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->string('type');
            $table->foreignUlid('asset_id')->nullable()->references('id')->on('assets')->restrictOnDelete();
            $table->foreignUlid('asset_maintenance_task_id')->nullable()->references('id')->on('asset_maintenance_tasks')->restrictOnDelete();
            $table->dateTime('failure_date')->nullable();
            $table->dateTime('completion_date')->nullable();
            $table->boolean('capitalize_repair_cost')->default(false);
            $table->integer('increase_in_asset_life')->nullable();
            $table->text('description')->nullable();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();

            // Submitable fields
            $table->json('status')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->foreignUlid('amended_from_id')->nullable()->references('id')->on('asset_services')->nullOnDelete();
            $table->integer('revision_number')->default(0);
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->json('additional_data')->nullable();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_services');
    }
};
