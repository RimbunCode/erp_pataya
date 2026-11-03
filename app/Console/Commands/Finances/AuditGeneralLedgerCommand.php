<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Audit\AuditReportRenderer;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Throwable;

class AuditGeneralLedgerCommand extends Command {
    protected $signature = 'finance:audit-gl
        {--limit=20 : Maksimum contoh per kategori anomali}
        {--json= : Tulis laporan lengkap ke berkas JSON (path berkas, atau folder; tanpa nilai memakai storage/app/finance-audit/)}
        {--connection= : Nama koneksi database (mis. replika baca)}';
    protected $description = 'Audit integritas general_ledgers (read-only): kelompok tak seimbang, GL yatim, soft-delete saat cancel, dan cakupan dokumen';

    public function handle(): int {
        $report = (new GeneralLedgerAuditor(connection: $this->option('connection') ?: null))
            ->run(['limit' => (int) $this->option('limit')]);

        (new AuditReportRenderer)->render($report, $this);

        if (! $this->input->hasParameterOption('--json')) {
            return self::SUCCESS;
        }

        $path = $this->resolveJsonPath((string) $this->option('json'));

        try {
            File::ensureDirectoryExists(dirname($path));
            File::put($path, $report->toJson());
        } catch (Throwable $e) {
            $this->error("Gagal menulis laporan JSON ke {$path}: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("Laporan JSON ditulis ke {$path}");

        return self::SUCCESS;
    }

    private function resolveJsonPath(string $option): string {
        $defaultName = 'audit-' . now()->format('Ymd-His') . '.json';

        if ($option === '') {
            return storage_path("app/finance-audit/{$defaultName}");
        }

        return str_ends_with(strtolower($option), '.json') ? $option : rtrim($option, '/\\') . DIRECTORY_SEPARATOR . $defaultName;
    }
}
