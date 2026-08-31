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
        Schema::create('desks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('icon');
            $table->string('background_color')->nullable();
            $table->string('foreground_color')->nullable();
            $table->string('domain')->nullable();
            $table->string('type');
            $table->boolean('is_personal_only')->default(false);
            $table->foreignUlid('owner_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('dashboard_id')->nullable()->references('id')->on('dashboards')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('desks');
    }
};
