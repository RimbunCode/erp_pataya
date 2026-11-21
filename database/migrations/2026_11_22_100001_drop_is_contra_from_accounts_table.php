<?php

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 2, Task 14.2 (Requirement 13.8): hapus kolom non-standar `accounts.is_contra`.
 *
 * Retur memakai akun lewat aturan `variant=return` pada Posting Profile, dan laporan Fase 5 memakai saldo
 * bertanda, jadi tidak ada lagi pembaca kolom ini.
 *
 * Prasyarat deploy: semua jenis dokumen sudah berada pada mode `on` dan Task 12.3 selesai, karena jalur
 * `off`/`shadow` lama tidak lagi membaca kolom ini (default akun retur di `SalesInvoiceController` dibuang).
 * Prasyarat itu DITEGAKKAN di `up()`: bila setting Finances sudah ada dan ada jenis dokumen yang belum `on`
 * (nilai null/hilang dibaca `off`), migrasi berhenti dengan pesan jelas dan kolom tidak disentuh. Instalasi baru
 * tanpa baris setting Finances (juga basis data uji) tidak punya jalur lama yang perlu dilindungi sehingga dilewati.
 *
 * `down()` menambah kembali kolom dengan atribut aslinya (`boolean`, default `false`, setelah
 * `balance_amount`), tetapi nilai flag yang sudah dihapus TIDAK dapat dipulihkan: semua baris kembali bernilai
 * `false` (termasuk akun seperti Akumulasi Penyusutan, Retur Penjualan, dan Potongan Penjualan yang semula `true`).
 * Pulihkan dari cadangan basis data bila nilai lama dibutuhkan.
 */
return new class extends Migration
{
    public function up(): void {
        $this->assertAllPostingModesOn();

        if (Schema::hasColumn('accounts', 'is_contra')) {
            Schema::table('accounts', function (Blueprint $table) {
                $table->dropColumn('is_contra');
            });
        }
    }

    public function down(): void {
        if (! Schema::hasColumn('accounts', 'is_contra')) {
            Schema::table('accounts', function (Blueprint $table) {
                $table->boolean('is_contra')->default(false)->after('balance_amount');
            });
        }
    }

    /**
     * Membaca langsung dari tabel (bukan lewat model/cache) agar migrasi tidak bergantung pada cache atau
     * singleton setting. Tidak ada tabel, kolom, atau baris setting berarti belum ada mode yang pernah diset.
     */
    private function assertAllPostingModesOn(): void {
        if (! Schema::hasTable('finance_settings') || ! Schema::hasColumn('finance_settings', 'posting_modes')) {
            return;
        }

        if (! DB::table('finance_settings')->exists()) {
            return;
        }

        $raw   = DB::table('finance_settings')->orderBy('created_at')->value('posting_modes');
        $modes = \is_string($raw) ? (json_decode($raw, true) ?: []) : [];

        $notOn = array_values(array_filter(
            PostingDocumentType::values(),
            static fn (string $type): bool => ($modes[$type] ?? FinanceSetting::POSTING_MODE_OFF) !== FinanceSetting::POSTING_MODE_ON,
        ));

        if ($notOn !== []) {
            throw new RuntimeException(
                'Migrasi drop accounts.is_contra (Finance Fase 2, Task 14.2, Requirement 13.8) ditolak: jenis dokumen berikut belum '
                . 'berada pada mode `on`: ' . implode(', ', $notOn) . '. Selesaikan Task 12.3 untuk semua jenis dan ubah semuanya ke '
                . '`on` (staging dan produksi) sebelum menjalankan migrasi ini.',
            );
        }
    }
};
