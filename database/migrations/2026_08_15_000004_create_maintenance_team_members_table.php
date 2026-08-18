<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('maintenance_team_members', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('maintenance_team_id')->references('id')->on('asset_maintenance_teams')->cascadeOnDelete();
            $table->foreignUlid('user_id')->references('id')->on('users')->restrictOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('maintenance_team_members');
    }
};
