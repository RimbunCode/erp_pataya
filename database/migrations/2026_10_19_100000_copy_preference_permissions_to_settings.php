<?php

use Database\Seeders\ModuleSettingPermissionSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Spec module-settings-foundation, Task 7.1 (Requirement 9.2).
     *
     * Instalasi yang sudah ada: salin baris role_permissions dari model
     * `Preference` ke `CoreSetting` dan beri System Manager flag penuh pada
     * semua model setting. Idempoten (updateOrCreate di seeder). Instalasi
     * baru tercakup lewat DatabaseSeeder, sehingga pemanggilan di sini aman
     * dijalankan ulang.
     */
    public function up(): void {
        app(ModuleSettingPermissionSeeder::class)->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        // Data izin hasil penyalinan tidak dihapus otomatis: penghapusan
        // bisa mencabut akses Company yang sedang dipakai. Kembalikan manual
        // lewat halaman Roles bila diperlukan.
    }
};
