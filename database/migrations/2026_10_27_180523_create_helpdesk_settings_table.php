<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('helpdesk_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->string('default_type')->nullable();
            $table->string('default_priority')->nullable();
            $table->unsignedSmallInteger('default_due_days')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('helpdesk_settings');
    }
};
