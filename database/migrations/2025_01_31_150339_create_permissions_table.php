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
        Schema::create('permissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('module');
            $table->string('name');
            $table->text('model');
            $table->string('route')->nullable();
            $table->json('permissions')->nullable();
            $table->boolean('is_submitable')->default(false);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['module', 'name', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
