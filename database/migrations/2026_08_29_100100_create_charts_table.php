<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('charts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('chart_name');
            $table->string('chart_source_type')->default('count');
            $table->string('visual_type')->default('line');
            $table->foreignUlid('model_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->string('model_class')->nullable();

            $table->boolean('timeseries')->default(false);
            $table->string('based_on')->nullable();
            $table->string('value_based_on')->nullable();
            $table->string('timespan')->nullable();
            $table->string('time_interval')->nullable();
            $table->date('from_date')->nullable();
            $table->date('to_date')->nullable();

            $table->string('group_by_based_on')->nullable();
            $table->string('group_by_type')->nullable();
            $table->string('aggregate_function_based_on')->nullable();
            $table->integer('number_of_groups')->nullable();

            $table->integer('heatmap_year')->nullable();
            $table->string('color')->nullable();
            $table->string('currency')->nullable();
            $table->boolean('show_values_over_chart')->default(false);
            $table->json('custom_options')->nullable();
            $table->string('method')->nullable();
            $table->json('filters')->nullable();

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
        Schema::dropIfExists('charts');
    }
};
