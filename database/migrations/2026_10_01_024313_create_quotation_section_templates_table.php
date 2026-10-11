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
        Schema::create('quotation_section_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('quotation_type')->nullable();
            $table->string('title');
            $table->text('content');
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('quotation_section_templates');
    }
};
