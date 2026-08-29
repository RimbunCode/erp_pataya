<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('chart_assignables', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('chart_id')->references('id')->on('charts')->cascadeOnDelete();
            $table->string('assignable_type');
            $table->ulid('assignable_id');
            $table->timestamps();

            $table->unique(['chart_id', 'assignable_type', 'assignable_id'], 'chart_assignables_unique');
        });
    }

    public function down(): void {
        Schema::dropIfExists('chart_assignables');
    }
};
