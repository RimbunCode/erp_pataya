<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom `is_example` dan `have_transactions` dideklarasikan eksplisit (F-12, Requirement 1.7): persis kolom yang
     * akan ditambahkan `DataTable::initPermissions()` untuk model non-submitable tanpa kode series, sehingga
     * `initPermissions()` no-op pada tabel ini.
     */
    public function up(): void {
        Schema::create('fiscal_years', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->unique();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 16)->default('open');
            $table->timestamps();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
        });
    }

    public function down(): void {
        Schema::dropIfExists('fiscal_years');
    }
};
