<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('finance_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->unsignedBigInteger('tax_invoice_serial_range_start')->default(0);
            $table->unsignedBigInteger('tax_invoice_serial_range_end')->default(0);
            $table->unsignedBigInteger('tax_invoice_serial_last_used')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('finance_settings');
    }
};
