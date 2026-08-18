<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_movements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->string('purpose');
            $table->date('transaction_date');
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
            $table->string('reference_type')->nullable();
            $table->ulid('reference_id')->nullable();
            $table->index(['reference_type', 'reference_id']);

            // Submitable fields
            $table->json('status')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->foreignUlid('amended_from_id')->nullable()->references('id')->on('asset_movements')->nullOnDelete();
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
        Schema::dropIfExists('asset_movements');
    }
};
