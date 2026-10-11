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
        Schema::create('quotation_sections', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('quotation_id')->references('id')->on('quotations')->cascadeOnDelete();
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
        Schema::dropIfExists('quotation_sections');
    }
};
