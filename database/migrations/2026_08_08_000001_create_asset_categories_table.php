<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('category_name')->unique();
            $table->boolean('non_depreciable_category')->default(false);
            $table->boolean('enable_cwip_accounting')->default(false);
            $table->boolean('is_rentable')->default(false);
            $table->string('default_depreciation_method')->nullable();
            $table->integer('default_frequency_of_depreciation')->nullable();
            $table->integer('default_total_number_of_depreciations')->nullable();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_categories');
    }
};
