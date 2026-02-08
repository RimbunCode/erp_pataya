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
        Schema::create('files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->text('path')->nullable();
            $table->string('extension')->nullable();
            $table->string('mime_type');
            $table->boolean('is_public')->default(false);
            $table->foreignUlid('user_id')->nullable()->references('id')->on('users')->cascadeOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('files');
    }
};
