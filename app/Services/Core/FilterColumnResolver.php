<?php

namespace App\Services\Core;

/**
 * Resolusi kolom untuk filter (dukung dot-notation relasi) dengan LAZY-LOAD
 * kolom anak relasi. Dipakai bersama oleh FilterEvaluator (query-time) dan
 * FilterTreeCleaner (save-time) agar resolusi konsisten.
 *
 * Masalah yang diselesaikan: Model::getColumns(1) TIDAK memuat kolom anak
 * relasi (off-by-one pada LinkModel::getColumns — depth 1 = relasi ada tapi
 * children kosong). Resolver ini, saat menemui segmen relasi, membaca model
 * terkait lalu memuat kolomnya sendiri (related::getColumns(1), per-model,
 * di-cache) — bukan getColumns(0) yang memicu rekursi nested besar.
 *
 * Relasi morph: kelas model konkret tidak diketahui dari struktur relasi —
 * diambil dari value item filter ({ type: <FQCN>, id: ... }).
 *
 * @phpstan-type ColumnNode array<string,mixed>
 */
class FilterColumnResolver {
    /**
     * Cache kolom per related class FQCN agar getColumns tidak dipanggil
     * berulang dalam satu request.
     *
     * @var array<string,list<array<string,mixed>>>
     */
    private array $childCache = [];

    /** @param array<string,array<string,mixed>>|list<array<string,mixed>> $columns kolom root (Model::getColumns) */
    public function __construct(private array $columns) {}

    /**
     * Resolusi sebuah key kolom. Untuk dot-notation relasi, telusuri tiap
     * segmen; kolom anak relasi dimuat lazily dari model terkait. `$itemValue`
     * dipakai untuk relasi morph (ambil FQCN dari value.type).
     *
     * @return array<string,mixed>|null
     */
    public function resolve(string $key, mixed $itemValue = null): ?array {
        if ($key === '') {
            return null;
        }

        if (! str_contains($key, '.')) {
            return $this->findByName($this->columns, $key);
        }

        $segments = explode('.', $key);
        $cols     = $this->columns;
        $column   = null;

        foreach ($segments as $i => $segment) {
            $column = $this->findByName($cols, $segment);
            if ($column === null) {
                return null;
            }

            $isLast = $i === count($segments) - 1;
            if ($isLast) {
                return $column;
            }

            // Segmen tengah harus relasi — muat kolom anaknya.
            $cols = $this->childColumns($column, $itemValue);
            if ($cols === null) {
                return null;
            }
        }

        return $column;
    }

    /**
     * Resolusi key dot-notation menjadi rantai relasi + kolom akhir, agar
     * pemanggil dapat membangun nested whereHas. Untuk key tanpa relasi
     * (skalar biasa) `relations` kosong dan `column` adalah kolomnya.
     *
     * Bentuk relasi: { function: <nama method relasi>, isMorph: bool }.
     * `column` adalah node kolom AKHIR; `columnName` adalah nama kolom relatif
     * terhadap tabel relasi terdalam (untuk dipakai di dalam closure whereHas).
     *
     * @return array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}|null
     */
    public function resolvePath(string $key, mixed $itemValue = null): ?array {
        if ($key === '') {
            return null;
        }

        $segments  = explode('.', $key);
        $cols      = $this->columns;
        $relations = [];
        $column    = null;

        foreach ($segments as $i => $segment) {
            $column = $this->findByName($cols, $segment);
            if ($column === null) {
                return null;
            }

            $isLast = $i === count($segments) - 1;
            if ($isLast) {
                return [
                    'relations'  => $relations,
                    'column'     => $column,
                    'columnName' => $column['name'] ?? $segment,
                ];
            }

            // Segmen tengah harus relasi.
            $type = $column['type'] ?? null;
            if (! in_array($type, ['relation', 'relations'], true)) {
                return null;
            }
            $relations[] = [
                'function' => $column['nameOfFunction'] ?? $column['name'] ?? $segment,
                'isMorph'  => ($column['typeRelation'] ?? 'basic') === 'morph',
            ];

            $cols = $this->childColumns($column, $itemValue);
            if ($cols === null) {
                return null;
            }
        }

        return null;
    }

    /**
     * Kolom anak dari sebuah node relasi. Inline `columns` dipakai bila sudah
     * terisi; jika kosong, lazy-load dari model terkait.
     *
     * @param  array<string,mixed>  $column
     * @return list<array<string,mixed>>|null
     */
    private function childColumns(array $column, mixed $itemValue): ?array {
        $type = $column['type'] ?? null;
        if (! in_array($type, ['relation', 'relations'], true)) {
            return null; // segmen tengah bukan relasi → key tidak valid
        }

        // Inline children sudah tersedia (mis. getColumns(0)).
        if (! empty($column['columns']) && is_array($column['columns'])) {
            return array_values($column['columns']);
        }

        $relatedClass = $this->relatedClassFor($column, $itemValue);
        if ($relatedClass === null) {
            return null;
        }

        return $this->loadColumns($relatedClass);
    }

    /**
     * Tentukan FQCN model terkait untuk sebuah node relasi.
     * - basic: dari node `related`.
     * - morph: dari value item ({ type: <FQCN> }).
     *
     * @param  array<string,mixed>  $column
     */
    private function relatedClassFor(array $column, mixed $itemValue): ?string {
        $isMorph = ($column['typeRelation'] ?? 'basic') === 'morph';

        if ($isMorph) {
            $morphType = $this->morphTypeFromValue($itemValue);

            return $this->isValidColumnModel($morphType) ? $morphType : null;
        }

        $related = $column['related'] ?? null;

        return is_string($related) && $this->isValidColumnModel($related) ? $related : null;
    }

    /**
     * Ekstrak FQCN morph dari value item. Bentuk value:
     *   single: { type: <FQCN>, id }   ·   list: [ { type, id }, ... ]
     */
    private function morphTypeFromValue(mixed $itemValue): ?string {
        if (! is_array($itemValue)) {
            return null;
        }
        if (isset($itemValue['type']) && is_string($itemValue['type'])) {
            return $itemValue['type'];
        }
        // list of morph pairs — ambil type pertama yang valid.
        foreach ($itemValue as $entry) {
            if (is_array($entry) && isset($entry['type']) && is_string($entry['type'])) {
                return $entry['type'];
            }
        }

        return null;
    }

    /**
     * Muat & cache kolom model terkait. Memakai getColumns(1) (kolom langsung
     * model relasi, TANPA rekursi nested besar seperti getColumns(0)); relasi
     * level berikutnya pada path bertingkat di-expand terpisah per-model lewat
     * pemanggilan ulang method ini. Hasil di-cache per FQCN.
     *
     * @return list<array<string,mixed>>
     */
    private function loadColumns(string $relatedClass): array {
        if (isset($this->childCache[$relatedClass])) {
            return $this->childCache[$relatedClass];
        }

        $cols = static::columnsForModel($relatedClass);

        return $this->childCache[$relatedClass] = array_values(is_array($cols) ? $cols : []);
    }

    /**
     * Cache statik per FQCN lintas instance resolver dalam satu request — sebuah
     * model relasi sering dipakai banyak filter/halaman; getColumns(1) membaca
     * skema DB sehingga mahal bila diulang.
     *
     * @var array<string,list<array<string,mixed>>>
     */
    private static array $modelColumnsCache = [];

    /**
     * @return list<array<string,mixed>>
     */
    private static function columnsForModel(string $relatedClass): array {
        if (! isset(static::$modelColumnsCache[$relatedClass])) {
            // includeHidden=true: child cols menyertakan FK relasi nested ber-flag
            // hidden agar dot-notation atas FK ter-resolve (UI tetap meng-gate hidden).
            $cols                                     = $relatedClass::getColumns(1, true);
            static::$modelColumnsCache[$relatedClass] = array_values(is_array($cols) ? $cols : []);
        }

        return static::$modelColumnsCache[$relatedClass];
    }

    /**
     * @param  array<string,mixed>|list<array<string,mixed>>  $cols
     * @return array<string,mixed>|null
     */
    private function findByName(array $cols, string $name): ?array {
        if (isset($cols[$name]) && is_array($cols[$name])) {
            return $cols[$name];
        }
        foreach ($cols as $col) {
            if (is_array($col) && ($col['name'] ?? null) === $name) {
                return $col;
            }
        }

        return null;
    }

    /**
     * Pastikan class ada dan memakai trait yang menyediakan getColumns.
     */
    private function isValidColumnModel(?string $class): bool {
        return is_string($class)
            && class_exists($class)
            && method_exists($class, 'getColumns');
    }

    // ---- Expand untuk transport ke frontend -----------------------------

    /**
     * Expand kolom anak relasi untuk setiap key dot-notation yang dipakai pada
     * filter tree, agar `dataTableColumns` yang dikirim ke frontend sudah memuat
     * kolom relasi terpakai (FilterItem2 dapat me-resolve value tanpa fetch
     * async). Mengembalikan SALINAN `$columns` yang sudah ter-expand — tidak
     * memutasi struktur asli (hindari bug reference).
     *
     * @param  array<string,mixed>  $tree  filter tree ({ root: group })
     * @return array<string,array<string,mixed>>|list<array<string,mixed>>
     */
    public function expandColumnsForTree(array $tree): array {
        // Kumpulkan path segmen-relasi (tanpa segmen kolom akhir) + value-nya.
        $paths = [];
        foreach ($this->collectKeys($tree) as [$key, $value]) {
            if (! str_contains($key, '.')) {
                continue;
            }
            $segments = explode('.', $key);
            array_pop($segments); // buang kolom akhir → sisakan rantai relasi
            $paths[] = [$segments, $value];
        }

        return $this->expandLevel($this->columns, $paths);
    }

    /**
     * Expand satu level kolom: untuk node relasi yang menjadi segmen pertama
     * pada salah satu path, isi `columns` anaknya (load bila kosong) lalu
     * rekursi ke sisa path. Mengembalikan salinan kolom (immutable).
     *
     * @param  array<string,mixed>|list<array<string,mixed>>  $cols
     * @param  list<array{0:list<string>,1:mixed}>  $paths
     * @return array<string,mixed>|list<array<string,mixed>>
     */
    private function expandLevel(array $cols, array $paths): array {
        if ($paths === []) {
            return $cols;
        }

        // Kelompokkan sisa-path per nama segmen pertama.
        $byHead = [];
        foreach ($paths as [$segments, $value]) {
            if ($segments === []) {
                continue;
            }
            $head            = $segments[0];
            $rest            = array_slice($segments, 1);
            $byHead[$head][] = [$rest, $value];
        }

        $result = [];
        foreach ($cols as $idx => $col) {
            if (! is_array($col)) {
                $result[$idx] = $col;

                continue;
            }
            $name = $col['name'] ?? null;
            $rest = is_string($name) ? ($byHead[$name] ?? null) : null;

            if (
                $rest !== null
                && in_array($col['type'] ?? null, ['relation', 'relations'], true)
            ) {
                $children = $col['columns'] ?? [];
                if (empty($children)) {
                    $value        = $rest[0][1] ?? null;
                    $relatedClass = $this->relatedClassFor($col, $value);
                    $children     = $relatedClass !== null ? $this->loadColumns($relatedClass) : [];
                }
                // Rekursi: expand sisa path pada anak relasi (path bertingkat).
                $col['columns'] = $this->expandLevel(
                    $children,
                    array_values(array_filter($rest, fn ($p) => $p[0] !== [])),
                );
            }

            $result[$idx] = $col;
        }

        return $result;
    }

    /**
     * Kumpulkan pasangan [key, value] dari seluruh item pada filter tree.
     *
     * @param  array<string,mixed>  $tree
     * @return list<array{0:string,1:mixed}>
     */
    private function collectKeys(array $tree): array {
        $root  = $tree['root'] ?? $tree;
        $pairs = [];

        $walk = function (array $node) use (&$walk, &$pairs): void {
            $children = $node['c'] ?? $node['children'] ?? null;
            if (is_array($children)) {
                foreach ($children as $child) {
                    if (is_array($child)) {
                        $walk($child);
                    }
                }

                return;
            }
            $key = $node['k'] ?? null;
            if (is_string($key) && $key !== '') {
                $pairs[] = [$key, $node['v'] ?? null];
            }
        };

        if (is_array($root)) {
            $walk($root);
        }

        return $pairs;
    }
}
