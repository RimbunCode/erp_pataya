<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('asset_category_accounts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_category_id')->references('id')->on('asset_categories')->cascadeOnDelete();
            $table->foreignUlid('branch_id')->references('id')->on('branches')->cascadeOnDelete();
            $table->foreignUlid('fixed_asset_account_id')->nullable()->references('id')->on('accounts')->nullOnDelete();
            // Nama constraint default Laravel utk 2 kolom di bawah melebihi batas
            // 64 karakter identifier MySQL — beri nama constraint pendek eksplisit.
            $table->foreignUlid('accumulated_depreciation_account_id')->nullable();
            $table->foreign('accumulated_depreciation_account_id', 'aca_accum_depr_account_fk')->references('id')->on('accounts')->nullOnDelete();
            $table->foreignUlid('depreciation_expense_account_id')->nullable()->references('id')->on('accounts')->nullOnDelete();
            $table->foreignUlid('capital_work_in_progress_account_id')->nullable();
            $table->foreign('capital_work_in_progress_account_id', 'aca_cwip_account_fk')->references('id')->on('accounts')->nullOnDelete();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('asset_category_accounts');
    }
};
