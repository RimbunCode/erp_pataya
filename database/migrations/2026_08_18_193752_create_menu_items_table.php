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
        Schema::create('menu_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('label');
            $table->string('icon');
            $table->string('route_name');
            $table->string('model')->nullable();
            $table->foreignUlid('parent_id')->nullable()->references('id')->on('menu_items')->nullOnDelete();
            $table->unsignedInteger('order')->default(0);
            $table->foreignUlid('primary_desk_id')->references('id')->on('desks')->cascadeOnDelete();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('menu_items');
    }
};
