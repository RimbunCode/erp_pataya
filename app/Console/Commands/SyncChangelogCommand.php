<?php

namespace App\Console\Commands;

use App\Models\Core\Changelog;
use App\Services\Core\ChangelogService;
use Illuminate\Console\Command;

class SyncChangelogCommand extends Command {
    protected $signature = 'changelog:sync
                            {--path= : Path ke file CHANGELOG.md (default: project root)}
                            {--environment=production : Environment label (production/staging)}
                            {--dry-run : Tampilkan hasil parse tanpa menyimpan ke DB}
                            {--reprocess : Reprocess content_html dari records yang sudah ada di DB}';
    protected $description = 'Sinkronisasi data dari CHANGELOG.md ke database';

    public function handle(ChangelogService $changelogService): int {
        if ($this->option('reprocess')) {
            return $this->reprocess($changelogService);
        }

        $path = $this->option('path') ?? base_path('CHANGELOG.md');
        $env  = $this->option('environment');

        if (! file_exists($path)) {
            $this->error("File tidak ditemukan: {$path}");

            return self::FAILURE;
        }

        $content = file_get_contents($path);
        $entries = $this->parseChangelog($content);

        if (empty($entries)) {
            $this->warn('Tidak ada entry changelog yang ditemukan.');

            return self::SUCCESS;
        }

        $this->info('Ditemukan ' . count($entries) . ' entry.');

        if ($this->option('dry-run')) {
            foreach ($entries as $entry) {
                $this->line("  [{$entry['version']}] " . mb_strimwidth($entry['content'], 0, 60, '...'));
            }

            return self::SUCCESS;
        }

        $synced = 0;
        foreach ($entries as $entry) {
            $changelogService->store($entry['version'], $env, $entry['content']);
            $this->line("  ✓ {$entry['version']}");
            $synced++;
        }

        $this->info("Selesai: {$synced} entry disimpan ke database.");

        return self::SUCCESS;
    }

    private function reprocess(ChangelogService $changelogService): int {
        $changelogs = Changelog::all();

        if ($changelogs->isEmpty()) {
            $this->warn('Tidak ada changelog di database.');

            return self::SUCCESS;
        }

        $this->info('Reprocess ' . $changelogs->count() . ' entry...');

        foreach ($changelogs as $changelog) {
            $changelogService->store($changelog->version, $changelog->environment, $changelog->content_raw);
            $this->line("  ✓ {$changelog->version}");
        }

        $this->info('Selesai.');

        return self::SUCCESS;
    }

    /**
     * Parse CHANGELOG.md format Keep a Changelog.
     * Tiap section diawali ## [version] atau ## version.
     *
     * @return array<int, array{version: string, content: string}>
     */
    private function parseChangelog(string $content): array {
        // Split by "## " header — each match is one version block
        $blocks  = preg_split('/^## /m', $content, -1, PREG_SPLIT_NO_EMPTY);
        $entries = [];

        foreach ($blocks as $block) {
            $lines  = explode("\n", trim($block), 2);
            $header = trim($lines[0]);
            $body   = isset($lines[1]) ? trim($lines[1]) : '';

            // Extract version from header: [1.2.3] or 1.2.3 (with optional date)
            if (! preg_match('/\[?([\d]+\.[\d]+\.[\d]+[^\]\s]*)\]?/', $header, $m)) {
                continue;
            }

            $version   = 'v' . ltrim($m[1], 'v');
            $entries[] = [
                'version' => $version,
                'content' => "## {$header}\n\n{$body}",
            ];
        }

        return $entries;
    }
}
