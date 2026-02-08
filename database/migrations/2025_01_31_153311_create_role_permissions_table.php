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
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
            $table->string('name');
            $table->text('model');
            $table->foreignUlid('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->unsignedTinyInteger('level')->default(0);
            $table->boolean('only_creator')->default(false);
            $table->boolean('is_submitable')->default(false);
            $table->json('permissions')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['role_id', 'permission_id', 'level', 'only_creator', 'deleted_at'], 'role_permissions_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
