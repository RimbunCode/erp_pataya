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
        Schema::create('sales_invoices', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->timestamp('date');
            $table->foreignUlid('return_against_id')->nullable()->references('id')->on('sales_invoices')->nullOnDelete();
            $table->foreignUlid('debit_account_id')->nullable()->references('id')->on('accounts')->nullOnDelete();
            $table->foreignUlid('income_account_id')->nullable()->references('id')->on('accounts')->nullOnDelete();
            $table->foreignUlid('customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->foreignUlid('customer_branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
            $table->string('customer_branch_name')->nullable();
            $table->foreignUlid('sales_order_id')->nullable()->references('id')->on('sales_orders')->nullOnDelete();
            $table->double('amount')->default(0);
            $table->double('amount_base_currency')->storedAs('IF(exchange_rate IS NULL, amount, amount * exchange_rate)');
            $table->double('paid_amount')->default(0);
            $table->double('paid_amount_base_currency')->storedAs('IF(exchange_rate IS NULL, paid_amount, paid_amount * exchange_rate)');
            $table->double('outstanding_amount')->storedAs('amount - paid_amount');
            $table->double('outstanding_amount_base_currency')->storedAs('IF(exchange_rate IS NULL, outstanding_amount, outstanding_amount * exchange_rate)');
            $table->string('discount_on')->nullable();
            $table->double('discount_rate')->default(0);
            $table->double('discount_amount')->default(0);
            $table->double('discount_amount_base_currency')->storedAs('IF(exchange_rate IS NULL, discount_amount, discount_amount * exchange_rate)');
            $table->foreign('currency_code')->references('code')->on('currencies')->nullOnDelete();
            $table->string('currency_code')->nullable();
            $table->foreign('base_currency_code')->references('code')->on('currencies')->nullOnDelete();
            $table->string('base_currency_code')->nullable();
            $table->double('exchange_rate')->nullable();
            $table->text('external_note')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('sales_invoices');
    }
};
