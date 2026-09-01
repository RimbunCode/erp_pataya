<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('number_card_assignables', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('number_card_id')->references('id')->on('number_cards')->cascadeOnDelete();
            $table->string('assignable_type');
            $table->ulid('assignable_id');
            $table->timestamps();

            $table->unique(['number_card_id', 'assignable_type', 'assignable_id'], 'number_card_assignables_unique');
        });
    }

    public function down(): void {
        Schema::dropIfExists('number_card_assignables');
    }
};
