<?php

namespace App\Console\Commands\Finances;

use App\Models\Finances\Tax;
use App\Services\Finances\Tax\TaxRuleInitializer;
use Illuminate\Console\Command;

/**
 * Membuat versi aturan 1 untuk setiap pajak yang belum punya versi (Finance Fase 3, Requirement 6.1-6.3):
 * `effective_from` 1970-01-01, `rate` dari `taxes.rate`, faktor DPP 11/12 (menyamai kolom generated invoice),
 * `per_line`, langsung `active`, ditandai `migrated; needs review`. Idempoten dan tidak menimpa versi yang ada.
 *
 * Pajak yang tarif efektifnya (rate x 11/12) bukan bilangan bulat dilaporkan untuk ditinjau akuntan (Q-P3-1);
 * laporan tidak mengubah data. `--dry-run` hanya melaporkan.
 */
class InitTaxRulesCommand extends Command {
    protected $signature   = 'finance:init-tax-rules {--dry-run : Hanya laporan, tidak membuat versi apa pun}';
    protected $description = 'Buat versi aturan pajak 1 untuk pajak yang belum punya versi, dan laporkan tarif yang mencurigakan terhadap faktor DPP 11/12';

    public function handle(TaxRuleInitializer $initializer): int {
        $report = $initializer->analyze();

        $this->renderReport($report);

        if ($this->option('dry-run')) {
            $this->newLine();
            $this->info('Mode dry-run: tidak ada yang ditulis.');

            return self::SUCCESS;
        }

        $result = $initializer->apply($report);

        $this->newLine();
        $this->info('Versi 1 dibuat: ' . \count($result['created']) . '.');

        foreach ($result['failed'] as $failure) {
            $this->error("Gagal untuk pajak \"{$failure['tax']->name}\": {$failure['message']}");
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  array{create: list<array{tax: Tax, effective_rate: float, suspicious: bool}>, skipped: list<Tax>, invalid: list<Tax>}  $report
     */
    private function renderReport(array $report): void {
        $this->info('Pajak yang akan dibuatkan versi 1: ' . \count($report['create']));
        if ($report['create'] !== []) {
            $this->table(['Pajak', 'Rate', 'Tarif efektif (rate x 11/12)', 'Tinjau'], array_map(
                static fn (array $row): array => [
                    $row['tax']->name . ($row['tax']->trashed() ? ' (dihapus)' : ''),
                    $row['tax']->rate,
                    number_format($row['effective_rate'], 4, '.', '') . '%',
                    $row['suspicious'] ? 'ya' : '',
                ],
                $report['create'],
            ));
        }

        $suspicious = array_values(array_filter($report['create'], static fn (array $row): bool => $row['suspicious']));
        $this->newLine();
        $this->warn('Tarif mencurigakan terhadap faktor DPP 11/12 (tarif efektif bukan bilangan bulat; tinjau dengan akuntan, Q-P3-1): ' . \count($suspicious));
        foreach ($suspicious as $row) {
            $this->line("  - {$row['tax']->name}: rate {$row['tax']->rate} menjadi " . number_format($row['effective_rate'], 4, '.', '') . '% efektif');
        }

        $this->newLine();
        $this->line('Dilewati karena sudah punya versi: ' . \count($report['skipped']));

        if ($report['invalid'] !== []) {
            $this->newLine();
            $this->warn('Tidak dapat dibuatkan versi (rate di luar 0-100; betulkan manual): ' . \count($report['invalid']));
            foreach ($report['invalid'] as $tax) {
                $this->line("  - {$tax->name}: rate {$tax->rate}");
            }
        }
    }
}
