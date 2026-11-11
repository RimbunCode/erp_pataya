<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dokumen Journal Voucher (Finance Fase 1, Task 11.1; Requirement 12): jurnal manual yang melewati approval dan
     * baru diposting lewat `JournalService::post()` setelah disetujui. Tabel ini TIDAK menyimpan baris GL.
     *
     * Kolom DataTable/Submitable dideklarasikan eksplisit (F-12, Requirement 1.7), persis kolom yang akan ditambahkan
     * `DataTable::initPermissions()` untuk model submitable (tanpa `have_transactions`), sehingga `initPermissions()`
     * no-op pada tabel ini.
     */
    public function up(): void {
        Schema::create('journal_vouchers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->timestamp('date');
            $table->text('description')->nullable();
            $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();

            // Kolom Submitable.
            $table->json('status')->nullable();
            $table->foreignUlid('created_by_id')->references('id')->on('users')->restrictOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->unsignedTinyInteger('revision_number')->default(0);
            $table->foreignUlid('amended_from_id')->nullable()->references('id')->on('journal_vouchers')->nullOnDelete();
            $table->json('additional_data')->nullable();
            $table->string('submitted_format')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
        });
    }

    public function down(): void {
        Schema::dropIfExists('journal_vouchers');
    }
};
