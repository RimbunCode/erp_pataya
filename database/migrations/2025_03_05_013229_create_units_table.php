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
        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code');
            $table->string('name');
            $table->string('group')->nullable();
            $table->double('conversion_factor')->nullable()->default(1);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('units');
    }
};
