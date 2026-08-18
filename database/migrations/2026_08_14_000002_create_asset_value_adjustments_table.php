<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_value_adjustments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->date('date');
            $table->decimal('current_asset_value', 15, 2);
            $table->decimal('new_asset_value', 15, 2);
            $table->foreignUlid('difference_account_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();

            // Submitable fields
            $table->json('status')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->foreignUlid('amended_from_id')->nullable()->references('id')->on('asset_value_adjustments')->nullOnDelete();
            $table->integer('revision_number')->default(0);
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->json('additional_data')->nullable();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_value_adjustments');
    }
};
