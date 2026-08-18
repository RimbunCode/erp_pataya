<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_maintenance_teams', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('team_name')->unique();
            $table->foreignUlid('manager_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_maintenance_teams');
    }
};
