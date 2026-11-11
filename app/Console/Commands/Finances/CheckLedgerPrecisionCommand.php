<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Audit\LedgerPrecisionChecker;
use Illuminate\Console\Command;

/**
 * Pra-pemeriksaan presisi `general_ledgers.debit`/`credit` (Finance Fase 1, Task 8.1(b), Requirement 13.1).
 * Read-only. Kode keluar non-nol bila ada baris dengan selisih pembulatan 4 desimal yang bermakna (> 1e-5).
 */
class CheckLedgerPrecisionCommand extends Command {
    protected $signature = 'finance:check-ledger-precision
        {--connection= : Nama koneksi database (mis. replika baca)}';
    protected $description = 'Periksa presisi debit/kredit general_ledgers sebelum konversi ke decimal(20,4) (read-only)';

    public function handle(): int {
        $checker = new LedgerPrecisionChecker($this->option('connection') ?: null);
        $result  = $checker->check();
        $size    = $checker->tableSize();

        $this->table(['Pemeriksaan', 'Nilai'], [
            ['total_baris (termasuk soft-deleted)', $result['total_baris']],
            ['hit_ketat (selisih > 1e-9)', $result['hit_ketat']],
            ['hit_bermakna (selisih > 1e-5)', $result['hit_bermakna']],
            ['nilai_maks', $result['nilai_maks']],
            ['ukuran tabel (byte)', $size['data_size'] ?? 'n/a'],
        ]);

        if ($result['hit_bermakna'] > 0) {
            $this->error("{$result['hit_bermakna']} baris memiliki presisi lebih dari 4 desimal bermakna; konversi ke decimal(20,4) akan membulatkannya.");

            return self::FAILURE;
        }

        if ($result['hit_ketat'] > 0) {
            $this->warn('hit_ketat > 0 tetapi hit_bermakna = 0: kemungkinan derau double (periksa nilai_maks; untuk |x| >= 2^36 ulp double melebihi 1e-5).');
        }

        $this->info('Pra-pemeriksaan presisi lolos.');

        return self::SUCCESS;
    }
}
