<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('tiket_responses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('tiket_id')->references('id')->on('tikets')->cascadeOnDelete();
            $table->foreignUlid('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('assign_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->string('status');
            $table->tinyInteger('progress')->default(0);
            $table->longText('content')->nullable();
            $table->datetime('end_date')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('tiket_responses');
    }
};
