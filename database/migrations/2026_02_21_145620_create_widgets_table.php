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
        Schema::create('widgets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->string('type');
            $table->string('calculation_type')->nullable();
            $table->string('time_based_on')->nullable();
            $table->string('time_interval')->nullable();
            $table->string('time_span')->nullable();
            $table->string('value_based_on')->nullable();
            $table->string('group_by_type')->nullable();
            $table->string('group_by_base_on')->nullable();
            $table->string('aggregate_function_based_on')->nullable();
            $table->json('filters')->nullable();
            $table->json('config')->nullable();
            $table->text('description')->nullable();
            $table->foreignUlid('created_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('model_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->string('model_class')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('widgets');
    }
};
