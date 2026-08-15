<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_service_activities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_service_id')->references('id')->on('asset_services')->cascadeOnDelete();
            $table->dateTime('action_date');
            $table->foreignUlid('pic_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->text('description');
            $table->boolean('is_done')->default(false);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_service_activities');
    }
};
