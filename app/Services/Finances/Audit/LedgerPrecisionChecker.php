<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pra-pemeriksaan presisi `general_ledgers.debit`/`credit` sebelum konversi `double` menjadi `decimal(20,4)`
 * (Finance Fase 1, Requirement 13.1, Task 8.1(b)). Read-only: hanya `SELECT`.
 *
 * Logika sama dengan query 8.1(a) di `design.md` (Rilis 1, langkah 2) yang dijalankan pemilik produk di staging:
 * dua ambang karena ambang mutlak 1e-9 memberi positif palsu pada nilai besar (satu ulp double pada 1e9 sudah
 * 1,2e-7).
 *  - `hit_ketat`    : jumlah baris dengan |ROUND(x,4) - x| > 1e-9 (rumusan Req 13.1);
 *  - `hit_bermakna` : jumlah baris dengan |ROUND(x,4) - x| > 1e-5 (memisahkan pecahan sungguhan dari derau double).
 * Semua baris dihitung, termasuk yang soft-deleted, karena `ALTER` mengubah semua baris. Ambang ditulis sebagai
 * literal (bukan binding): SQLite mengikat parameter sebagai teks sehingga perbandingan angka salah (lihat
 * `IntegrityChecks`). `GREATEST` tidak dipakai (tidak ada di SQLite); nilai maksimum diambil di PHP.
 *
 * Kelas ini dipakai bersama oleh perintah `finance:check-ledger-precision` dan oleh migration
 * `convert_general_ledgers_amounts_to_decimal` (pengaman). Ketergantungan migration pada kelas ini disengaja;
 * kelas tidak boleh dihapus atau dipindah tanpa memperbarui migration itu.
 */
final class LedgerPrecisionChecker {
    public const STRICT_THRESHOLD     = 1e-9;
    public const MEANINGFUL_THRESHOLD = 1e-5;

    public function __construct(private ?string $connection = null) {}

    /**
     * @param  float|null  $guardThreshold  ambang tambahan (mis. ambang pengaman migration); bila diberikan, hasil
     *                                      memuat `hit_ambang` (jumlah baris yang melampauinya)
     * @return array{total_baris: int, hit_ketat: int, hit_bermakna: int, nilai_maks: float, hit_ambang: int|null, ambang: float|null}
     */
    public function check(?float $guardThreshold = null): array {
        $db = $this->db();

        $selects = [
            'COUNT(*) AS total_baris',
            'COALESCE(SUM(' . $this->exceeds(self::STRICT_THRESHOLD) . '), 0) AS hit_ketat',
            'COALESCE(SUM(' . $this->exceeds(self::MEANINGFUL_THRESHOLD) . '), 0) AS hit_bermakna',
            'MAX(ABS(debit)) AS maks_debit',
            'MAX(ABS(credit)) AS maks_credit',
        ];
        if ($guardThreshold !== null) {
            $selects[] = 'COALESCE(SUM(' . $this->exceeds($guardThreshold) . '), 0) AS hit_ambang';
        }

        $row = $db->table('general_ledgers')->selectRaw(implode(', ', $selects))->first();

        return [
            'total_baris'  => (int) $row->total_baris,
            'hit_ketat'    => (int) $row->hit_ketat,
            'hit_bermakna' => (int) $row->hit_bermakna,
            'nilai_maks'   => max((float) $row->maks_debit, (float) $row->maks_credit),
            'hit_ambang'   => $guardThreshold !== null ? (int) $row->hit_ambang : null,
            'ambang'       => $guardThreshold,
        ];
    }

    /**
     * Ukuran tabel (byte) bila driver melaporkannya; null bila tidak tersedia (mis. SQLite).
     *
     * @return array{data_size: int|null, jumlah_baris: int}
     */
    public function tableSize(): array {
        $size = null;

        foreach (Schema::connection($this->connection)->getTables() as $table) {
            if (($table['name'] ?? null) === 'general_ledgers') {
                $size = isset($table['size']) ? (int) $table['size'] : null;
                break;
            }
        }

        return [
            'data_size'    => $size,
            'jumlah_baris' => $this->db()->table('general_ledgers')->count(),
        ];
    }

    private function exceeds(float $threshold): string {
        $literal = sprintf('%.12F', $threshold);

        return "CASE WHEN ABS(ROUND(debit, 4) - debit) > {$literal} OR ABS(ROUND(credit, 4) - credit) > {$literal} THEN 1 ELSE 0 END";
    }

    private function db(): Connection {
        return DB::connection($this->connection);
    }
}
