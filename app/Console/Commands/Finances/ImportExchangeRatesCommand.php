<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Currency\Providers\CsvImportProvider;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Mengimpor kurs dari berkas CSV (Finance Fase 4, Requirement 1.4; Task 2.5): validasi per baris, laporan galat per
 * baris, idempoten (kurs identik dilewati; kurs berbeda hanya mengubah baris yang belum dirujuk transaksi).
 * `--dry-run` menjalankan seluruh impor lalu membatalkannya, hanya untuk laporan. Keluar non-nol bila ada baris galat.
 */
class ImportExchangeRatesCommand extends Command {
    protected $signature = 'finance:import-exchange-rates
        {file : Path berkas CSV (header: from_currency_code,to_currency_code,rate_type,rate,rate_date)}
        {--dry-run : Validasi dan laporkan tanpa menyimpan}';
    protected $description = 'Impor kurs dari berkas CSV (kurs memakai titik desimal, maks 5 MB / 50.000 baris) dengan validasi per baris dan laporan galat';

    public function handle(CsvImportProvider $provider): int {
        $path = (string) $this->argument('file');
        if (! is_file($path) || ! is_readable($path)) {
            $this->error("Berkas tidak ditemukan atau tidak dapat dibaca: {$path}");

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        if ($dryRun) {
            DB::beginTransaction();
        }

        try {
            $report = $provider->importFile($path);
        } finally {
            if ($dryRun) {
                DB::rollBack();
            }
        }

        $this->info("Dibuat: {$report->created}, diubah: {$report->updated}, tidak berubah: {$report->unchanged}, galat: " . \count($report->errors) . '.');
        foreach ($report->errors as $error) {
            $this->error("  Baris {$error['line']}: {$error['message']}");
        }
        if ($dryRun) {
            $this->newLine();
            $this->info('Mode dry-run: tidak ada yang disimpan.');
        }

        return $report->hasErrors() ? self::FAILURE : self::SUCCESS;
    }
}
