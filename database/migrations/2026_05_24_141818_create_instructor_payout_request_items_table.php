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
        Schema::create('instructor_payout_request_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('payout_request_id')->references('id')->on('instructor_payout_requests')->cascadeOnDelete();
            $table->foreignUlid('earning_id')->references('id')->on('instructor_earnings')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['payout_request_id', 'earning_id', 'deleted_at'], 'instructor_payout_items_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('instructor_payout_request_items');
    }
};
