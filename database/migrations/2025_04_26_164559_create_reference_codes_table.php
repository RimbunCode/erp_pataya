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
        Schema::create('reference_codes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('model')->unique();
            $table->unsignedInteger('current')->default(0);
            $table->string('format_code');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reference_codes');
    }
};
