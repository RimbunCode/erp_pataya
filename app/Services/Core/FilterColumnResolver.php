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
 * terkait lalu memuat kolomnya sendiri (related::getColumns(0)).
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
     * Muat & cache kolom model terkait (getColumns(0)).
     *
     * @return list<array<string,mixed>>
     */
    private function loadColumns(string $relatedClass): array {
        if (isset($this->childCache[$relatedClass])) {
            return $this->childCache[$relatedClass];
        }

        $cols = $relatedClass::getColumns(0);

        return $this->childCache[$relatedClass] = array_values(is_array($cols) ? $cols : []);
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
}
