<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('purchase_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->foreignUlid('default_tax_id')->nullable()->constrained('taxes')->nullOnDelete();
            $table->foreignUlid('default_target_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->decimal('over_receipt_tolerance_percent', 5, 2)->nullable()->default(null);
            $table->decimal('over_billing_tolerance_percent', 5, 2)->nullable()->default(null);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('purchase_settings');
    }
};
