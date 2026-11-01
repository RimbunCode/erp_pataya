<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Audit\BalanceSnapshotService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class SnapshotBalancesCommand extends Command {
    protected $signature = 'finance:snapshot-balances
        {--path= : Berkas CSV tujuan (default storage/app/finance-audit/baseline-<timestamp>.csv)}
        {--connection= : Nama koneksi database (mis. replika baca)}';
    protected $description = 'Snapshot saldo per akun ke CSV (baseline rekonsiliasi Finance Fase 1; read-only)';

    public function handle(): int {
        $path = $this->option('path') ?: storage_path('app/finance-audit/baseline-' . now()->format('Ymd-His') . '.csv');

        File::ensureDirectoryExists(dirname($path));
        $handle = @fopen($path, 'w');

        if ($handle === false) {
            $this->error("Tidak dapat menulis berkas CSV di {$path}");

            return self::FAILURE;
        }

        try {
            $rows = (new BalanceSnapshotService($this->option('connection') ?: null))->write($handle);
        } finally {
            fclose($handle);
        }

        $this->info("Baseline {$rows} akun ditulis ke {$path}");

        return self::SUCCESS;
    }
}
