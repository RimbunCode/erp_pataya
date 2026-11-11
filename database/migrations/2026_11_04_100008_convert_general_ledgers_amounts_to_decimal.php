<?php

use App\Services\Finances\Audit\LedgerPrecisionChecker;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance Fase 1, Task 8.3 (Requirement 1.3 sisanya, 13.2, 13.3): `general_ledgers.debit`/`credit` dari `double`
 * menjadi `decimal(20,4) default 0` (D-3, disetujui pemilik produk 2026-11-04) dan FK akun (`account_id`,
 * `against_account_id`) dari `cascadeOnDelete` menjadi `restrictOnDelete`. `against_account_id` nullable sudah
 * dikerjakan migration `..._100005` (Q-P1-3).
 *
 * TERKUNCI (Rilis 1, Task 8): migration ini HANYA boleh digabung ke `dev-1` setelah pemilik produk menjalankan
 * query presisi 8.1(a) di staging (lihat `design.md`, "Migrasi, Rollback, dan Urutan Aman", Rilis 1 langkah 2) dan
 * melaporkan hasilnya. Bila `hit_ketat` > 0, ambang pengaman di bawah (atau daftar pengecualian) ditetapkan oleh
 * pemilik produk sebelum penggabungan, agar pengaman tidak menggagalkan deploy staging (`migrate --force` memakai
 * `set -e`).
 *
 * Pengaman: sebelum DDL apa pun (DDL MySQL tidak transaksional), `up()` menjalankan pra-pemeriksaan presisi dan menolak
 * jalan bila ada baris (termasuk soft-deleted) dengan |ROUND(x,4) - x| > ambang pada `debit`/`credit`. Ambang dibaca
 * dari `config('finance.ledger_precision_guard_threshold')` (default 1e-9 = `hit_ketat`, Req 13.1; env
 * `FINANCE_LEDGER_PRECISION_GUARD_THRESHOLD`). Migration ini bergantung pada
 * `App\Services\Finances\Audit\LedgerPrecisionChecker` (logika yang sama dengan perintah
 * `finance:check-ledger-precision`); kelas itu tidak boleh dihapus atau dipindah tanpa memperbarui migration ini.
 *
 * Aman dijalankan ulang: tiap langkah memeriksa keadaan skema saat ini (tipe kolom, aturan hapus FK) sehingga `up()`
 * yang terhenti di tengah (DDL MySQL tidak dapat di-rollback) dapat dilanjutkan dengan `migrate` lagi. Langkah-langkah
 * memakai `Schema::table` terpisah (drop lalu add FK tidak digabung dalam satu `ALTER`).
 *
 * Indeks pendukung FK: migration `..._100004` sudah membuat indeks `(account_id, transaction_date)` yang dapat
 * menopang FK `account_id`, dan MySQL mempertahankan indeks FK lama saat FK dilepas; migration ini tidak membuang
 * indeks apa pun. `against_account_id` memakai indeks bawaan FK-nya.
 */
return new class extends Migration
{
    private const FK_COLUMNS     = ['account_id', 'against_account_id'];
    private const AMOUNT_COLUMNS = ['debit', 'credit'];

    /** `down()` menolak jalan bila ada nilai yang tidak dapat dipertahankan eksak oleh `double` dengan 4 desimal. */
    private const DOWN_MAX_ABS = 1e11;

    /** Batas atas `decimal(20,4)`: 16 digit sebelum koma. */
    private const UP_MAX_ABS = 1e16;

    public function up(): void {
        $this->assertPrecisionIsSafe();

        // Per kolom: MySQL menjalankan satu ALTER per kolom, jadi proses yang terhenti di antara keduanya harus
        // dapat dilanjutkan (Requirement 13.2).
        foreach (self::AMOUNT_COLUMNS as $column) {
            if ($this->columnIsFloating($column)) {
                Schema::table('general_ledgers', fn (Blueprint $table) => $table->decimal($column, 20, 4)->default(0)->change());
            }
        }

        foreach (self::FK_COLUMNS as $column) {
            $this->replaceForeignKey($column, 'restrict');
        }
    }

    /**
     * Urutan kebalikan `up()`: FK dikembalikan ke `cascadeOnDelete`, lalu kolom ke `double`.
     *
     * PERINGATAN presisi: `double` hanya menyimpan ~15 digit signifikan, sehingga nilai `decimal(20,4)` besar
     * kehilangan presisi. Karena itu `down()` menolak jalan bila ada |debit|/|kredit| >= 1e11. Dengan nilai di bawah
     * batas itu, 4 desimal tetap terwakili dalam rentang derau double yang sama dengan sebelum `up()`.
     */
    public function down(): void {
        $limit    = sprintf('%.0F', self::DOWN_MAX_ABS); // literal: SQLite mengikat parameter sebagai teks
        $tooLarge = DB::table('general_ledgers')
            ->whereRaw("ABS(debit) >= {$limit} OR ABS(credit) >= {$limit}")
            ->exists();
        if ($tooLarge) {
            throw new RuntimeException('Tidak dapat mengembalikan debit/credit ke double: ada nilai >= 1e11 yang akan kehilangan presisi.');
        }

        foreach (self::FK_COLUMNS as $column) {
            $this->replaceForeignKey($column, 'cascade');
        }

        foreach (self::AMOUNT_COLUMNS as $column) {
            if (! $this->columnIsFloating($column)) {
                Schema::table('general_ledgers', fn (Blueprint $table) => $table->double($column)->default(0)->change());
            }
        }
    }

    private function assertPrecisionIsSafe(): void {
        $threshold = (float) config('finance.ledger_precision_guard_threshold', LedgerPrecisionChecker::STRICT_THRESHOLD);
        $result    = (new LedgerPrecisionChecker)->check($threshold);

        if ($result['nilai_maks'] >= self::UP_MAX_ABS) {
            throw new RuntimeException(sprintf('Konversi general_ledgers.debit/credit ke decimal(20,4) dibatalkan: ada nilai mutlak >= %s yang tidak muat di decimal(20,4) (nilai_maks=%s).', sprintf('%.0F', self::UP_MAX_ABS), sprintf('%.4F', $result['nilai_maks'])));
        }

        if ($result['hit_ambang'] > 0) {
            throw new RuntimeException(sprintf(
                'Konversi general_ledgers.debit/credit ke decimal(20,4) dibatalkan: %d dari %d baris memiliki presisi lebih dari 4 desimal di atas ambang pengaman %s (hit_ketat=%d, hit_bermakna=%d, nilai_maks=%s). Tinjau dengan "php artisan finance:check-ledger-precision"; ambang hanya boleh dilonggarkan oleh pemilik produk (config finance.ledger_precision_guard_threshold).',
                $result['hit_ambang'],
                $result['total_baris'],
                sprintf('%.12F', $threshold),
                $result['hit_ketat'],
                $result['hit_bermakna'],
                $result['nilai_maks'],
            ));
        }
    }

    private function columnIsFloating(string $name): bool {
        foreach (Schema::getColumns('general_ledgers') as $column) {
            if ($column['name'] === $name) {
                return \in_array(strtolower((string) ($column['type_name'] ?? $column['type'])), ['double', 'float', 'real'], true);
            }
        }

        return false;
    }

    /**
     * Mengganti FK akun ke aturan hapus yang diminta (`restrict` atau `cascade`); no-op bila sudah sesuai. Drop dan
     * add dilakukan di `Schema::table` terpisah.
     */
    private function replaceForeignKey(string $column, string $onDelete): void {
        $existing = collect(Schema::getForeignKeys('general_ledgers'))
            ->first(fn (array $foreignKey) => $foreignKey['columns'] === [$column]);

        if ($existing !== null && strtolower((string) $existing['on_delete']) === $onDelete) {
            return;
        }

        if ($existing !== null) {
            Schema::table('general_ledgers', fn (Blueprint $table) => $table->dropForeign($existing['name'] ?? [$column]));
        }

        Schema::table('general_ledgers', function (Blueprint $table) use ($column, $onDelete) {
            $foreign = $table->foreign($column)->references('id')->on('accounts');
            $onDelete === 'restrict' ? $foreign->restrictOnDelete() : $foreign->cascadeOnDelete();
        });
    }
};
