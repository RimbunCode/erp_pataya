<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Ledger\JournalBackfillService;
use Illuminate\Console\Command;
use Throwable;

/**
 * Backfill GL lama menjadi jurnal legacy (Finance Fase 1, Task 7.1, Requirement 9, D-8).
 *
 * Aman dijalankan ulang (idempoten per kelompok) dan dapat dilanjutkan setelah gagal. Gunakan `--dry-run` lebih
 * dulu. **Jalankan di luar jam transaksi**: Σ sebelum/sesudah dibandingkan atas seluruh tabel, sehingga posting baru
 * di antara keduanya tampak sebagai selisih palsu. Langkah manual di staging/produksi (Task 7.5):
 * `finance:backfill-journals --dry-run`, tinjau, jalankan nyata, bandingkan dengan baseline Fase 0
 * (`finance:snapshot-balances`), lalu `finance:reconcile-ledger`; setelah backfill, cabut `--ignore-unjournaled`
 * dari jadwal `finance:reconcile-ledger` di `routes/console.php` (Q-P1-11).
 */
class BackfillJournalsCommand extends Command {
    protected $signature = 'finance:backfill-journals
        {--dry-run : Hitung dan laporkan saja tanpa menulis apa pun}
        {--chunk=1000 : Jumlah dokumen yang dimuat per putaran}
        {--limit= : Batas jumlah jurnal yang dibuat (atau yang akan dibuat pada --dry-run)}';
    protected $description = 'Menggabungkan baris general_ledgers lama (tanpa journal_id) menjadi jurnal legacy per dokumen sumber (idempoten)';

    public function handle(JournalBackfillService $service): int {
        $chunk = (int) $this->option('chunk');
        $limit = $this->option('limit');

        if ($chunk < 1 || ($limit !== null && $limit !== '' && (! ctype_digit((string) $limit) || (int) $limit < 1))) {
            $this->error('--chunk dan --limit harus berupa bilangan bulat positif.');

            return self::INVALID;
        }

        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) {
            $this->warn('Mode --dry-run: tidak ada data yang ditulis.');
        }

        try {
            $report = $service->run($dryRun, $chunk, $limit === null || $limit === '' ? null : (int) $limit);
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->render($report);

        return $report['failures'] === [] && $report['mismatched_accounts'] === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  array<string, mixed>  $report
     */
    private function render(array $report): void {
        $verb = $report['dry_run'] ? 'akan dibuat' : 'dibuat';

        $this->newLine();
        $this->info('Ringkasan backfill');
        $this->table(['Item', 'Jumlah'], [
            ['Dokumen diproses', $report['documents']],
            ["Jurnal legacy {$verb}", $report['journals']],
            ['Baris GL digabungkan', $report['lines']],
            ['Jurnal tak seimbang (legacy_unbalanced)', $report['unbalanced_journals']],
            ["Jurnal legacy berstatus voided {$verb} (dari baris soft-deleted)", $report['voided_journals']],
            ['Baris soft-deleted sebelum backfill', $report['soft_deleted_rows']],
            ['Kegagalan', \count($report['failures'])],
        ]);

        $years = $report['years'];
        if ($years['from'] !== null) {
            $this->line(($report['dry_run'] ? 'Rentang tahun fiskal yang akan dibuat: ' : 'Tahun fiskal dilengkapi: ') . "{$years['from']}-{$years['to']}"
                . ($years['generated'] === [] ? '' : ' (' . implode(', ', $years['generated']) . ')'));
            foreach ($years['warnings'] as $warning) {
                $this->warn("Peringatan periode fiskal: {$warning}");
            }
        }

        if ($report['limit_reached']) {
            $this->warn('Batas --limit tercapai; jalankan ulang untuk melanjutkan.');
        }

        $this->newLine();
        $this->info('Rekonsiliasi (baris aktif, sebelum dan sesudah; baris soft-deleted tidak ikut Σ)');
        $this->table(['', 'Baris', 'Σ debit', 'Σ kredit'], [
            ['Sebelum', $report['before']['rows'], $this->money($report['before']['sum_debit']), $this->money($report['before']['sum_credit'])],
            ['Sesudah', $report['after']['rows'], $this->money($report['after']['sum_debit']), $this->money($report['after']['sum_credit'])],
        ]);
        $this->line("Baris aktif tanpa journal_id: {$report['rows_without_journal']['active']}; soft-deleted tanpa journal_id: {$report['rows_without_journal']['soft_deleted']}");

        if ($report['mismatched_accounts'] !== []) {
            $this->error('Σdebit/Σkredit atau jumlah baris berubah pada akun: ' . implode(', ', $report['mismatched_accounts']));
        } elseif (! $report['dry_run']) {
            $this->info('Σdebit/Σkredit per akun sama sebelum dan sesudah.');
        }

        foreach ($report['failures'] as $failure) {
            $this->error($failure);
        }
    }

    private function money(float $value): string {
        return number_format($value, 4, '.', ',');
    }
}
