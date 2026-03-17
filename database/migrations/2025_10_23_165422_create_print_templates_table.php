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
        Schema::create('print_templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->foreignUlid('permission_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->boolean('is_letter_head')->default(false);
            $table->foreignUlid('letter_head_id')->nullable()->references('id')->on('print_templates')->nullOnDelete();
            $table->string('name_model')->nullable();
            $table->string('model')->nullable();
            $table->longText('html')->nullable();
            $table->longText('css')->nullable();
            $table->json('template')->nullable();
            $table->boolean('is_default')->default(false);
            $table->string('default_languange')->nullable();
            $table->string('font_family')->nullable();
            $table->string('page')->nullable();
            $table->string('page_number')->nullable();
            $table->string('orientation')->default('potrait');
            $table->double('width')->nullable();
            $table->double('height')->nullable();
            $table->double('margin_top')->nullable();
            $table->double('margin_bottom')->nullable();
            $table->double('margin_left')->nullable();
            $table->double('margin_right')->nullable();
            $table->boolean('show_absolute_values')->default(false);
            $table->string('unit')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['name', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('prints');
    }
};
