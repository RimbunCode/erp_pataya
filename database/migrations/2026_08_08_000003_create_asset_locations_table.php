<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_locations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('location_name')->unique();
            $table->foreignUlid('parent_id')->nullable()->references('id')->on('asset_locations')->nullOnDelete();
            $table->boolean('is_group')->default(false);
            $table->foreignUlid('branch_id')->references('id')->on('branches')->cascadeOnDelete();
            $table->unsignedInteger('lft')->default(0);
            $table->unsignedInteger('rgt')->default(0);
            $table->unsignedInteger('depth')->default(0);
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_locations');
    }
};
