<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_depreciation_schedules', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->date('schedule_date');
            $table->decimal('depreciation_amount', 15, 2);
            $table->decimal('accumulated_depreciation_amount', 15, 2);
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_depreciation_schedules');
    }
};
