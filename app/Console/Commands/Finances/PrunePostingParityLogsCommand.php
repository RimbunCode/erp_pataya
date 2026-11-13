<?php

namespace App\Console\Commands\Finances;

use App\Models\Finances\PostingParityLog;
use Illuminate\Console\Command;

/**
 * Membersihkan `posting_parity_logs` yang lebih tua dari masa retensi (Finance Fase 2, Requirement 11.4): default
 * `config('finance.posting.parity_retention_days')` (90 hari), dapat ditimpa `--days`. Catatan parity tidak pernah
 * diubah; pembersihan lewat query builder (model tidak memperbolehkan hapus per baris).
 */
class PrunePostingParityLogsCommand extends Command {
    protected $signature   = 'finance:prune-parity-logs {--days= : Retensi dalam hari (default dari config finance.posting.parity_retention_days)}';
    protected $description = 'Hapus catatan parity posting engine yang melewati masa retensi';

    public function handle(): int {
        $days = $this->option('days') ?? config('finance.posting.parity_retention_days');
        if (! is_numeric($days) || (int) $days < 1) {
            $this->error('Retensi harus bilangan bulat positif (hari).');

            return self::FAILURE;
        }

        $deleted = PostingParityLog::query()
            ->withoutGlobalScopes()
            ->where('created_at', '<', now()->subDays((int) $days))
            ->toBase()
            ->delete();

        $this->info("Catatan parity dihapus: {$deleted} (retensi {$days} hari).");

        return self::SUCCESS;
    }
}
