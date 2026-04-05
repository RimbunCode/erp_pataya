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
        Schema::create('payment_entries', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->timestamp('date');
            $table->string('payment_type');
            $table->string('party_type')->nullable();
            $table->nullableUlidMorphs('paymentable');
            $table->nullableUlidMorphs('partyable');
            $table->double('paid_amount')->default(0);
            $table->double('base_paid_amount')->default(0);
            $table->double('exchange_rate')->default(0);
            $table->foreignUlid('account_paid_to_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->foreignUlid('account_paid_from_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->string('currency_code')->nullable();
            $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
            $table->string('base_currency_code')->nullable();
            $table->foreignUlid('payment_method_id')->nullable()->references('id')->on('payment_methods')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('payment_entries');
    }
};
