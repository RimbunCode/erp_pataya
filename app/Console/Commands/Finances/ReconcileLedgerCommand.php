<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Ledger\LedgerReconciliationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Rekonsiliasi invarian ledger jurnal (Finance Fase 1, Task 7.3, Requirement 10). Dijadwalkan harian di
 * `routes/console.php`. Keluar dengan kode non-nol dan mencatat peringatan di log bila ada pelanggaran; jurnal
 * `legacy_unbalanced` hanya dilaporkan sebagai informasi.
 */
class ReconcileLedgerCommand extends Command {
    protected $signature = 'finance:reconcile-ledger
        {--limit=20 : Maksimum contoh per pemeriksaan}
        {--ignore-unjournaled : Laporkan baris tanpa journal_id sebagai informasi (mis. sebelum backfill dijalankan)}';
    protected $description = 'Memeriksa invarian jurnal: keseimbangan, total, baris tanpa jurnal, dan jurnal tanpa baris (read-only)';

    private const LABELS = [
        'a_unbalanced_journals'   => '(a) Jurnal non-legacy tak seimbang',
        'b_total_mismatch'        => '(b) Total jurnal tidak sama dengan Σ baris',
        'c_lines_without_journal' => '(c) Baris (termasuk soft-deleted) tanpa journal_id',
        'd_posted_without_lines'  => '(d) Jurnal posted tanpa baris aktif',
    ];

    public function handle(LedgerReconciliationService $service): int {
        $report = $service->run(max(1, (int) $this->option('limit')), (bool) $this->option('ignore-unjournaled'));

        $rows = [];
        foreach ($report['violations'] as $key => $violation) {
            $rows[] = [self::LABELS[$key], $violation['count'], $violation['count'] > 0 ? 'PELANGGARAN' : 'OK'];
        }
        $this->table(['Pemeriksaan', 'Jumlah', 'Status'], $rows);

        $this->info('Informasi');
        $this->table(['Item', 'Jumlah'], collect($report['info'])->map(fn (int $count, string $key) => [$key, $count])->values()->all());

        foreach ($report['violations'] as $key => $violation) {
            foreach ($violation['samples'] as $sample) {
                $this->line(self::LABELS[$key] . ': ' . json_encode($sample, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            }
        }

        if ($report['failed']) {
            Log::warning('finance:reconcile-ledger menemukan pelanggaran invarian ledger.', [
                'violations' => collect($report['violations'])->map(fn (array $violation) => $violation['count'])->all(),
            ]);
            $this->error('Ditemukan pelanggaran invarian ledger.');

            return self::FAILURE;
        }

        $this->info('Semua invarian ledger terpenuhi.');

        return self::SUCCESS;
    }
}
