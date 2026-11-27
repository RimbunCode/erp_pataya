<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Master pajak berklasifikasi (Finance Fase 3, Requirement 1.1-1.2; menyerap spec
     * `dpp-discount-and-tax-compliance` Requirement 4).
     *
     * Seluruh baris existing diberi `category = unclassified` dan `behavior = additive`: migration TIDAK menebak
     * klasifikasi (perilaku hitung sekarang = additive untuk semua pajak) dan akuntan yang menetapkannya.
     * `is_creditable` hanya bermakna untuk pajak masukan (PPN Masukan yang dapat dikreditkan).
     */
    public function up(): void {
        Schema::table('taxes', function (Blueprint $table) {
            $table->string('category', 32)->default('unclassified');
            $table->string('behavior', 16)->default('additive');
            $table->string('jurisdiction_code', 8)->default('ID');
            $table->boolean('is_creditable')->default(true);
        });
    }

    public function down(): void {
        Schema::table('taxes', function (Blueprint $table) {
            $table->dropColumn(['category', 'behavior', 'jurisdiction_code', 'is_creditable']);
        });
    }
};
