<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('purchase_order_batch_submissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->ulid('branch_id')->nullable();
            $table->ulid('token');
            $table->uuid('idempotency_key');
            $table->char('payload_hash', 64);
            $table->json('purchase_order_ids');
            $table->timestamps();
            $table->unique(['user_id', 'idempotency_key'], 'po_batch_user_key_unique');
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchase_order_batch_submissions');
    }
};
