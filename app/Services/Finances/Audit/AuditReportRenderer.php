<?php

namespace App\Services\Finances\Audit;

use Illuminate\Console\Command;

/**
 * Merender `AuditReport` ke konsol (tabel ringkasan, contoh per kategori, matriks cakupan).
 * Keluaran konsol berbahasa Indonesia tetap, tanpa kunci terjemahan (requirement 8.3).
 */
final class AuditReportRenderer {
    private const SECTION_LABELS = [
        'unbalanced_groups'       => 'Kelompok posting tak seimbang',
        'zero_or_negative'        => 'Baris nol atau negatif',
        'soft_deleted_expected'   => 'Soft-delete diharapkan (dokumen canceled)',
        'soft_deleted_unexpected' => 'Soft-delete anomali (dokumen bukan canceled / tidak ada)',
        'dangling_account'        => 'Akun hilang atau terhapus',
        'orphan_reference'        => 'Referenceable tidak ditemukan',
        'canceled_active_gl'      => 'Dokumen canceled dengan GL aktif (F-16)',
        'duplicates'              => 'Duplikasi posting',
    ];

    public function render(AuditReport $report, Command $command): void {
        $totals = $report->totals;

        $command->info('Audit General Ledger (read-only) — ' . $report->generatedAt);
        $command->table(['Ringkasan', 'Nilai'], [
            ['Baris GL aktif', $totals['rows']],
            ['Baris GL soft-deleted', $totals['rows_soft_deleted']],
            ['Kelompok posting', $totals['groups']],
            ['Rentang tanggal transaksi', ($totals['date_min'] ?? '-') . ' s.d. ' . ($totals['date_max'] ?? '-')],
            ['Σ debit', $totals['sum_debit']],
            ['Σ kredit', $totals['sum_credit']],
            ['Selisih', $totals['diff']],
        ]);

        $command->table(['Kategori', 'Jumlah'], array_map(
            fn (string $key) => [self::SECTION_LABELS[$key] ?? $key, $report->sections[$key]['count']],
            array_keys($report->sections),
        ));

        foreach ($report->sections as $key => $section) {
            if (empty($section['samples'])) {
                continue;
            }

            $command->newLine();
            $command->line('<options=bold>' . (self::SECTION_LABELS[$key] ?? $key) . '</> — contoh (' . count($section['samples']) . ' dari ' . $section['count'] . ')');
            $command->table(
                array_keys($section['samples'][0]),
                array_map(fn (array $sample) => array_map($this->cell(...), $sample), $section['samples']),
            );
        }

        $command->newLine();
        $command->line('<options=bold>Matriks cakupan dokumen</>');
        $command->table(
            ['Jenis', 'Approved', 'Canceled', 'Punya GL', 'Cancel: GL soft-deleted', 'Cancel: GL aktif', 'Dilacak', 'Belum posted', 'Tanpa status posting'],
            array_map(fn (array $row) => [
                $row['type'] . ($row['available'] ? '' : ' (tidak tersedia)'),
                $this->cell($row['approved']),
                $this->cell($row['canceled']),
                $row['with_gl'],
                $row['canceled_gl_softdeleted'],
                $row['canceled_active_gl'],
                $row['tracked'] ? 'ya' : 'tidak dilacak',
                $this->cell($row['posting_not_posted']),
                $this->cell($row['posting_missing']),
            ], $report->coverage),
        );
    }

    private function cell(mixed $value): string {
        return $value === null ? '-' : (string) $value;
    }
}
