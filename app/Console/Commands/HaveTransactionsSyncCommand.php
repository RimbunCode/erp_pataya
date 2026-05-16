<?php

namespace App\Console\Commands;

use App\Services\Core\HaveTransactionsSyncService;
use Illuminate\Console\Command;

class HaveTransactionsSyncCommand extends Command {
    protected $signature = 'have-transactions:sync
                            {--dry-run : Simulasi tanpa mengubah data}
                            {--only= : Batasi target ke model class atau nama tabel}
                            {--chunk=1000 : Jumlah baris per chunk saat scan}';
    protected $description = 'Sinkronisasi ulang kolom have_transactions berdasarkan relasi aktif.';

    public function __construct(private readonly HaveTransactionsSyncService $syncService) {
        parent::__construct();
    }

    public function handle(): int {
        $chunk = (int) $this->option('chunk');
        if ($chunk < 1) {
            $this->error('--chunk harus lebih dari 0.');

            return self::INVALID;
        }

        try {
            $result = $this->syncService->recalculate(
                $this->option('only'),
                (bool) $this->option('dry-run'),
                $chunk,
            );
        } catch (\InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::INVALID;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info($result['dry_run'] ? 'Mode: DRY RUN' : 'Mode: APPLY');
        $this->line('Target tables: ' . implode(', ', $result['target_tables']));
        $this->line('Scanned tables: ' . $result['scanned_tables']);
        $this->line('References detected: ' . $result['references_detected']);
        $this->newLine();

        $rows = [];
        foreach ($result['target_tables'] as $table) {
            $rows[] = [
                'table'  => $table,
                'reset'  => $result['reset_counts'][$table] ?? 0,
                'marked' => $result['marked_counts'][$table] ?? 0,
            ];
        }

        $this->table(['Table', 'Reset Count', 'Marked Count'], $rows);

        return self::SUCCESS;
    }
}
