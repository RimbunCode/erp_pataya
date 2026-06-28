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
        Schema::create('changelogs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('version')->unique();
            $table->string('environment');
            $table->text('content_raw');
            $table->text('content_html');
            $table->timestamp('deployed_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('changelogs');
    }
};
