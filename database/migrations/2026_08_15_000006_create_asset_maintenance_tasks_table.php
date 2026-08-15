<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_maintenance_tasks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_maintenance_id')->references('id')->on('asset_maintenances')->cascadeOnDelete();
            $table->string('task_name');
            $table->string('maintenance_type');
            $table->unsignedInteger('periodicity');
            $table->date('next_due_date');
            $table->date('last_completion_date')->nullable();
            $table->foreignUlid('assign_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->boolean('certificate_required')->default(false);
            $table->text('description')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_maintenance_tasks');
    }
};
