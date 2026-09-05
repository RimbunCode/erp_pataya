<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('number_cards', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('label');
            $table->string('source_type')->default('document_type');
            $table->string('function')->nullable();
            $table->string('aggregate_function_based_on')->nullable();
            $table->foreignUlid('model_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->string('model_class')->nullable();
            $table->json('filters')->nullable();
            $table->string('currency')->nullable();
            $table->string('color')->nullable();
            $table->string('background_color')->nullable();
            $table->boolean('show_full_number')->default(false);
            $table->boolean('show_percentage_stats')->default(true);
            $table->string('stats_time_interval')->nullable();
            $table->string('method')->nullable();

            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->boolean('is_shared_all')->default(false);

            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('number_cards');
    }
};
