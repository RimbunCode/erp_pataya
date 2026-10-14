<?php

namespace Tests\Support;

use App\Services\Core\PrintTemplate\RelationTrackerService;
use Illuminate\Support\Str;

/**
 * Memeriksa tiap jalur Handlebars di markup print template terhadap daftar
 * kolom yang dipakai renderer.
 *
 * Field yang salah tidak menimbulkan error: `formatData()` (server dan
 * klien) membuang kunci yang tidak ada di daftar kolom model, sehingga hasil
 * cetaknya kosong tanpa peringatan. Kelas ini meniru penelusurannya:
 * `{{#each doc.items}}` mengganti model aktif ke model relasinya, dan tiap
 * segmen jalur harus ada di daftar kolom model yang sedang ditelusuri.
 */
class PrintTemplateFieldChecker {
    /** Helper Handlebars yang bukan jalur data. */
    private const NON_DATA_HELPERS = ['companyDetail', 'approvalSignature', 'label', 'else'];

    /** Helper Handlebars yang meneruskan jalur data pada argumennya. */
    private const VALUE_HELPERS = [
        'relation',
        'formatDate',
        'formatCurrency',
        'formatNumber',
        'uppercase',
        'multiply',
        'subtract',
        'add',
        'divide',
    ];

    private RelationTrackerService $tracker;

    public function __construct() {
        $this->tracker = app(RelationTrackerService::class);
    }

    /**
     * Kesalahan (kosong bila semua jalur valid).
     *
     * @param  array<int, string>  $usedRelations
     * @return array<int, string>
     */
    public function errors(string $model, array $usedRelations, string $html): array {
        $columns = $this->columnsFor($model, $usedRelations);
        $errors  = [];
        $loaded  = array_map(fn ($path) => $this->camelPath($path), $this->tracker->validateRelations($model, $usedRelations));

        foreach ($this->extractReferences($html) as $reference) {
            $segments = explode('.', $reference['path']);
            $root     = array_shift($segments);

            if ($root === 'company') {
                continue;
            }

            if (! \in_array($root, ['doc', 'this'], true)) {
                $errors[] = "akar tidak dikenal pada {$reference['path']}";

                continue;
            }

            // `idx` disisipkan renderer pada tiap baris koleksi; bukan kolom.
            if ($root === 'this' && $segments === ['idx']) {
                continue;
            }

            $current = $model;
            $chain   = [];

            if ($root === 'this') {
                foreach ($reference['scope'] as $segment) {
                    $column  = $columns[$current][$segment] ?? null;
                    $current = $column['related'] ?? null;
                    $chain[] = $segment;

                    if ($current === null) {
                        break;
                    }
                }
            }

            foreach ($segments as $index => $segment) {
                $column = $columns[$current][$segment] ?? null;

                if ($column === null) {
                    $errors[] = "field `{$segment}` tidak ada di " . class_basename((string) $current) . " (jalur {$reference['path']})";

                    continue 2;
                }

                $type   = $column['type'] ?? null;
                $isLast = $index === \count($segments) - 1;

                if (! $isLast) {
                    if ($type !== 'relation') {
                        $errors[] = "`{$segment}` bukan relasi tunggal (jalur {$reference['path']})";

                        continue 2;
                    }

                    $chain[]  = $segment;
                    $current  = $column['related'];
                    $errors[] = $this->unloadedError($chain, $loaded, $reference['path']);

                    continue;
                }

                if (\in_array($type, ['relation', 'relations'], true)) {
                    if ($reference['kind'] === 'relation' && $type === 'relation') {
                        $chain[]  = $segment;
                        $errors[] = $this->unloadedError($chain, $loaded, $reference['path']);

                        continue;
                    }

                    if (! \in_array($reference['kind'], ['each', 'if'], true)) {
                        $errors[] = "`{$reference['path']}` adalah {$type}, bukan nilai yang bisa dicetak";
                    }

                    $chain[]  = $segment;
                    $errors[] = $this->unloadedError($chain, $loaded, $reference['path']);
                }
            }
        }

        return array_values(array_filter($errors));
    }

    /**
     * Jalur relasi (camelCase, titik) yang dibutuhkan markup, urut dan unik.
     *
     * @param  array<int, string>  $usedRelations
     * @return array<int, string>
     */
    public function neededRelations(string $model, array $usedRelations, string $html): array {
        $columns = $this->columnsFor($model, $usedRelations);
        $needed  = [];

        foreach ($this->extractReferences($html) as $reference) {
            $segments = explode('.', $reference['path']);
            $root     = array_shift($segments);

            if ($root === 'company') {
                continue;
            }

            $chain = $root === 'doc' ? [] : $reference['scope'];

            // Segmen terakhir pada nilai adalah field, bukan relasi, kecuali
            // untuk #each/#if atau helper `relation` yang menunjuk relasinya sendiri.
            $relationSegments = \in_array($reference['kind'], ['each', 'if', 'relation'], true)
                ? $segments
                : \array_slice($segments, 0, -1);

            $full = [...$chain, ...$relationSegments];

            // `#if` pada field skalar bukan relasi.
            if ($reference['kind'] === 'if' && ! $this->isRelationPath($model, $columns, $full)) {
                $full = \array_slice($full, 0, -1);
            }

            for ($i = 1; $i <= \count($full); $i++) {
                $needed[] = $this->camelPath(implode('.', \array_slice($full, 0, $i)));
            }
        }

        $needed = array_values(array_unique($needed));
        sort($needed);

        return $needed;
    }

    public function camelPath(string $path): string {
        return collect(explode('.', $path))->map(fn ($segment) => Str::camel($segment))->implode('.');
    }

    /**
     * @param  array<int, string>  $chain
     * @param  array<int, string>  $loaded
     */
    private function unloadedError(array $chain, array $loaded, string $path): ?string {
        return \in_array($this->camelPath(implode('.', $chain)), $loaded, true)
            ? null
            : 'relasi ' . implode('.', $chain) . " tidak dimuat (jalur {$path})";
    }

    /**
     * @param  array<string, mixed>  $columns
     * @param  array<int, string>  $segments
     */
    private function isRelationPath(string $model, array $columns, array $segments): bool {
        foreach ($segments as $segment) {
            $column = $columns[$model][$segment] ?? null;

            if ($column === null || ! \in_array($column['type'] ?? null, ['relation', 'relations'], true)) {
                return false;
            }

            $model = $column['related'];
        }

        return $segments !== [];
    }

    /**
     * @param  array<int, string>  $usedRelations
     * @return array<string, mixed>
     */
    private function columnsFor(string $model, array $usedRelations): array {
        $result = $this->tracker->validateRelations($model, $usedRelations, true);

        return collect($result['modelColumns'])->map(fn ($columns) => collect($columns)->all())->all();
    }

    /**
     * @return array<int, array{kind: string, path: string, scope: array<int, string>}>
     */
    private function extractReferences(string $html): array {
        $references = [];
        $scopes     = [[]];

        preg_match_all('/\{\{\{?\s*([#\/^]?)\s*([^{}]*?)\s*\}?\}\}/', $html, $tokens, PREG_SET_ORDER);

        foreach ($tokens as $token) {
            $marker = $token[1];
            $body   = trim($token[2]);

            if ($body === '' || $body === 'else') {
                continue;
            }

            if ($marker === '/') {
                if ($body === 'each') {
                    array_pop($scopes);
                }

                continue;
            }

            $words = preg_split('/\s+/', $body);
            $head  = $words[0];

            if ($marker === '#') {
                if (\in_array($head, ['each', 'if'], true) && isset($words[1]) && ! str_starts_with($words[1], '@')) {
                    $references[] = ['kind' => $head, 'path' => $words[1], 'scope' => end($scopes)];

                    if ($head === 'each') {
                        $scopes[] = $this->scopeFor($words[1], end($scopes));
                    }
                }

                continue;
            }

            if (\in_array($head, self::VALUE_HELPERS, true)) {
                foreach (\array_slice($words, 1) as $arg) {
                    $cleanArg = trim($arg, "\"'");
                    if (str_starts_with($cleanArg, 'doc.') || str_starts_with($cleanArg, 'this.')) {
                        $references[] = ['kind' => $head === 'relation' ? 'relation' : 'value', 'path' => $cleanArg, 'scope' => end($scopes)];
                    }
                }

                continue;
            }

            if (\in_array($head, self::NON_DATA_HELPERS, true)) {
                continue;
            }

            $references[] = ['kind' => 'value', 'path' => $head, 'scope' => end($scopes)];
        }

        return $references;
    }

    /**
     * Relasi dari akar dokumen sampai koleksi yang sedang diiterasi.
     *
     * @param  array<int, string>  $current
     * @return array<int, string>
     */
    private function scopeFor(string $path, array $current): array {
        $segments = explode('.', $path);
        $root     = array_shift($segments);

        return $root === 'doc' ? $segments : [...$current, ...$segments];
    }
}
