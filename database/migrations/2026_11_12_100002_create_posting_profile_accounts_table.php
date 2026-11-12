<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Akun default per peran pada sebuah profil (Finance Fase 2, Requirement 2.1). Profil `draft` boleh dihapus
     * (cascade); profil `active`/`retired` tidak boleh dihapus di aplikasi. Akun `restrictOnDelete`: akun yang
     * dipakai profil tidak dapat dihapus permanen.
     *
     * Model baris ini tidak memakai `DataTable` (pola `JournalVoucherItem`), jadi tidak ada kolom `is_example`.
     */
    public function up(): void {
        Schema::create('posting_profile_accounts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('posting_profile_id')->references('id')->on('posting_profiles')->cascadeOnDelete();
            $table->string('role', 64);
            $table->foreignUlid('account_id')->references('id')->on('accounts')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['posting_profile_id', 'role'], 'posting_profile_accounts_profile_role_unique');
        });
    }

    public function down(): void {
        Schema::dropIfExists('posting_profile_accounts');
    }
};
