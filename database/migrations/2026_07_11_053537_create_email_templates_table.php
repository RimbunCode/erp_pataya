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
        Schema::create('email_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->foreignUlid('permission_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->string('name_model')->nullable();
            $table->string('model')->nullable();
            $table->boolean('is_default')->default(false);
            $table->string('subject');
            $table->longText('body_html');
            $table->json('body_json')->nullable();
            $table->string('default_language')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['name', 'deleted_at']);
            $table->index(['model', 'is_default']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('email_templates');
    }
};
