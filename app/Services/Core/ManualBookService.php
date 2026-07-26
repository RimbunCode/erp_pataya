<?php

namespace App\Services\Core;

use Illuminate\Support\Facades\File;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkExtension;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkProcessor;
use League\CommonMark\GithubFlavoredMarkdownConverter;
use RuntimeException;

class ManualBookService {
    /**
     * Ambil daftar section untuk halaman index (title, description, icon saja).
     *
     * @return array<int, array{key: string, title: string, description: string, icon: string}>
     */
    public function listSections(): array {
        $sections = config('manual_book.sections', []);

        return collect($sections)
            ->map(fn (array $section, string $key) => [
                'key'         => $key,
                'title'       => $section['title'],
                'description' => $section['description'] ?? '',
                'icon'        => $section['icon'] ?? 'FileText',
            ])
            ->values()
            ->all();
    }

    /**
     * Render satu section jadi HTML siap tampil. Return null jika section tidak dikenal.
     *
     * @return array{key: string, title: string, description: string, content_html: string}|null
     */
    public function renderSection(string $key): ?array {
        $section = config("manual_book.sections.{$key}");

        if ($section === null) {
            return null;
        }

        $markdown = $this->readMarkdown($section['source']);

        return [
            'key'          => $key,
            'title'        => $section['title'],
            'description'  => $section['description'] ?? '',
            'content_html' => $this->toHtml($this->stripTechnicalNoise($markdown)),
        ];
    }

    /**
     * Defense-in-depth di luar filter per-heading: hapus paragraf "**Routes...**"
     * (bold, bukan heading level 2/3) beserta tabel `Controller@method` yang
     * mengikutinya, lalu hapus baris/kalimat lain yang masih menyebut
     * Controller@method secara eksplisit. Dijalankan setelah filter section
     * agar tetap efektif untuk paragraf non-heading yang tidak tertangkap
     * filterSections()/stripSubHeadings().
     */
    private function stripTechnicalNoise(string $markdown): string {
        // Paragraf "**Routes ...**: ..." + tabel Method/URI/Route Name/Controller@method
        // yang mengikutinya (dengan atau tanpa baris kosong pemisah).
        $markdown = preg_replace(
            '/^\*\*Routes[^\n]*\n+(?:\|[^\n]*\n)+/m',
            '',
            $markdown,
        );

        // Sisa kalimat lepas yang masih menyebut Controller@method secara eksplisit.
        $lines = explode("\n", $markdown);
        $lines = array_filter($lines, fn (string $line) => preg_match('/\b[A-Z][A-Za-z]*Controller@[a-zA-Z]+\b/', $line) !== 1);

        return implode("\n", $lines);
    }

    /**
     * Baca 1 file source, lalu saring heading yang cocok
     * `default_excluded_heading_patterns` sebagai safety net (lihat konfigurasi).
     */
    private function readMarkdown(string $source): string {
        $docsPath     = config('manual_book.docs_path');
        $realDocsPath = realpath($docsPath);
        $targetPath   = realpath($docsPath . DIRECTORY_SEPARATOR . $source);

        if ($realDocsPath === false || $targetPath === false || ! str_starts_with($targetPath, $realDocsPath)) {
            throw new RuntimeException("Manual book source file tidak valid: {$source}");
        }

        $content = File::get($targetPath);

        return $this->filterExcludedHeadings($content, config('manual_book.default_excluded_heading_patterns', []));
    }

    /**
     * Potong konten markdown per heading level 2 (##), buang section yang cocok
     * pola exclude, lalu buang juga sub-section level 3 (###) yang cocok pola
     * exclude di dalam section yang tersisa. Heading level 1 (judul dokumen) dan
     * teks sebelum heading pertama selalu dibuang — halaman manual book punya
     * judulnya sendiri dari config.
     *
     * @param  array<int, string>  $excludePatterns
     */
    private function filterExcludedHeadings(string $content, array $excludePatterns): string {
        $blocks = preg_split('/^## /m', $content);
        array_shift($blocks);

        $kept = [];

        foreach ($blocks as $block) {
            $heading = trim(strstr($block, "\n", true) ?: $block);

            if ($this->matchesAnyPattern($heading, $excludePatterns)) {
                continue;
            }

            $kept[] = $this->stripSubHeadings("## {$block}", $excludePatterns);
        }

        return implode("\n\n", $kept);
    }

    /**
     * Hapus sub-section level 3 (###) yang cocok pola exclude di dalam sebuah
     * section level 2 yang lolos filter.
     *
     * @param  array<int, string>  $excludePatterns
     */
    private function stripSubHeadings(string $sectionContent, array $excludePatterns): string {
        $parts  = preg_split('/^### /m', $sectionContent);
        $result = array_shift($parts);

        foreach ($parts as $part) {
            $heading = trim(strstr($part, "\n", true) ?: $part);

            if ($this->matchesAnyPattern($heading, $excludePatterns)) {
                continue;
            }

            $result .= "### {$part}";
        }

        return $result;
    }

    /**
     * @param  array<int, string>  $patterns
     */
    private function matchesAnyPattern(string $heading, array $patterns): bool {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $heading) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Heading `## Judul` di-convert CommonMark tanpa atribut `id` secara default,
     * padahal setiap Daftar Isi di docs/ ditulis sebagai link `#slug-heading`
     * (dibuat manual, konsisten dengan gaya GitHub). Tanpa `id` di heading, klik
     * link Daftar Isi hanya mengubah URL browser tanpa efek scroll apa pun.
     * `HeadingPermalinkExtension` menambahkan id itu otomatis, dengan slug yang
     * pola-nya sama seperti yang sudah dipakai manual di semua docs (lowercase,
     * spasi→dash, buang karakter selain huruf/angka/dash).
     */
    private function toHtml(string $markdown): string {
        $converter = new GithubFlavoredMarkdownConverter([
            'html_input'         => 'strip',
            'allow_unsafe_links' => false,
            'heading_permalink'  => [
                'apply_id_to_heading' => true,
                'id_prefix'           => '',
                'insert'              => HeadingPermalinkProcessor::INSERT_NONE,
            ],
        ]);
        $converter->getEnvironment()->addExtension(new HeadingPermalinkExtension);

        return (string) $converter->convert($markdown);
    }
}
