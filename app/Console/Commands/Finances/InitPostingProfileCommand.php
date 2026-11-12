<?php

namespace App\Console\Commands\Finances;

use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\PostingProfileInitializer;
use Illuminate\Console\Command;
use Throwable;

/**
 * Membangkitkan Posting Profile awal dari COA saat ini (Finance Fase 2, Requirement 2.5). Tidak menebak bila lebih
 * dari satu akun cocok untuk sebuah peran: peran itu dilaporkan sebagai ambigu dan dibiarkan kosong untuk dipilih
 * akuntan. Idempoten. `--report` hanya melaporkan (tidak menulis apa pun), dipakai untuk audit COA data staging
 * (Task 1.3).
 */
class InitPostingProfileCommand extends Command {
    protected $signature = 'finance:init-posting-profile
        {--report : Hanya laporan, tidak menulis profil}
        {--effective-from= : Tanggal berlaku awal profil (Y-m-d); default awal tahun fiskal tertua, atau 1 Januari tahun ini}';
    protected $description = 'Bangkitkan Posting Profile awal (draft) dari COA saat ini dan laporkan peran yang tak ter-resolve atau ambigu';

    public function handle(PostingProfileInitializer $initializer): int {
        $report = $initializer->analyze();

        $this->renderReport($report);

        if ($this->option('report')) {
            $this->newLine();
            $this->info('Mode laporan: tidak ada yang ditulis.');

            return self::SUCCESS;
        }

        try {
            $result = $initializer->apply($report, $this->option('effective-from') ?: null);
        } catch (Throwable $e) {
            $this->error("Gagal membangkitkan profil: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->newLine();
        $this->renderResult($result);

        return self::SUCCESS;
    }

    /**
     * @param  array{resolved: array<string, array{id: string, label: string}>, ambiguous: array<string, list<string>>, missing: array<string, string>, master: list<string>}  $report
     */
    private function renderReport(array $report): void {
        $this->info('Peran ter-resolve (tepat satu akun cocok): ' . \count($report['resolved']));
        if ($report['resolved'] !== []) {
            $this->table(['Peran', 'Akun'], array_map(
                static fn (string $role, array $row): array => [$role, $row['label']],
                array_keys($report['resolved']),
                $report['resolved'],
            ));
        }

        $this->newLine();
        $this->warn('Peran ambigu (lebih dari satu akun cocok; tidak ditebak, pilih manual): ' . \count($report['ambiguous']));
        if ($report['ambiguous'] !== []) {
            $this->table(['Peran', 'Kandidat'], array_map(
                static fn (string $role, array $labels): array => [$role, implode("\n", $labels)],
                array_keys($report['ambiguous']),
                $report['ambiguous'],
            ));
        }

        $this->newLine();
        $this->warn('Peran tanpa akun pada COA: ' . \count($report['missing']));
        if ($report['missing'] !== []) {
            $this->table(['Peran', 'Pasangan root_type/account_type'], array_map(
                static fn (string $role, string $pair): array => [$role, $pair],
                array_keys($report['missing']),
                $report['missing'],
            ));
        }

        $this->newLine();
        $this->line('Peran akun master / tanpa padanan legacy (diisi dari master atau dilengkapi manual): ' . \count($report['master']));
        if ($report['master'] !== []) {
            $this->line('  ' . implode(', ', $report['master']));
        }
    }

    /**
     * @param  array{profile: PostingProfile|null, action: string, written: list<string>}  $result
     */
    private function renderResult(array $result): void {
        $profile = $result['profile'];

        match ($result['action']) {
            'created'   => $this->info("Profil awal dibuat (draft, berlaku dari {$profile->effective_from->toDateString()}) dengan " . \count($result['written']) . ' peran. Tinjau lalu aktifkan.'),
            'completed' => $this->info('Profil awal draft dilengkapi dengan peran: ' . implode(', ', $result['written']) . '.'),
            'unchanged' => $this->info('Profil awal draft sudah memuat semua peran yang dapat di-resolve; tidak ada perubahan.'),
            'locked'    => $this->warn("Profil awal sudah berstatus {$profile->status}; tidak diubah."),
            default     => null,
        };
    }
}
