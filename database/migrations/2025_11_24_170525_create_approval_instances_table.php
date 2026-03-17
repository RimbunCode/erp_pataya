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
        Schema::create('approval_instances', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('approval_scheme_id')->references('id')->on('approval_schemes')->cascadeOnDelete();
            $table->ulidMorphs('document');
            $table->string('status')->default('draft');
            $table->json('options')->nullable();
            $table->tinyInteger('current_sequence')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['document_type', 'document_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('approval_instances');
    }
};
