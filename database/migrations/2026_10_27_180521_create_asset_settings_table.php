<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->string('default_depreciation_method')->nullable();
            $table->unsignedInteger('default_frequency_of_depreciation')->nullable();
            $table->unsignedInteger('default_total_number_of_depreciations')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_settings');
    }
};
