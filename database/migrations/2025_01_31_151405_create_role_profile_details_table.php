<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('role_profile_details', function (Blueprint $table) {
            $table->foreignUlid('role_profile_id')->references('id')->on('role_profiles')->cascadeOnDelete();
            $table->foreignUlid('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['role_profile_id', 'role_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_profile_details');
    }
};
