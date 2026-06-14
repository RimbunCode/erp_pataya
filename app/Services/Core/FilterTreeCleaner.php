<?php

namespace App\Services\Core;

use Carbon\Carbon;

/**
 * Membersihkan & memvalidasi filter tree (mini-DSL FilterBuilder) SEBELUM
 * disimpan ke saved_filters. Mirror aturan kolom/operator/value-shape yang
 * dipakai App\Services\Core\FilterEvaluator (sumber kebenaran query) dan
 * resources/js/Components/Table/Filter/operators.js (frontend).
 *
 * Tugas:
 *   - Drop item dengan kolom/operator/value tidak valid (mirror evaluator).
 *   - Collapse/drop grup kosong (mirror collapseSingleChildGroups frontend).
 *   - Tidak mengubah/normalisasi nilai item yang valid (di luar scope).
 *
 * Grammar:
 *   tree  = { root: group } | group
 *   group = { k: "and"|"or", c: { <id>: group|item } }
 *   item  = { k: <column>, o: <operator>, v: <value> }
 *
 * @phpstan-type Node array<string,mixed>
 */
class FilterTreeCleaner {
    /**
     * Operator valid per type kolom (mirror FilterEvaluator::$operatorsByType
     * dan operators.js). set/!set universal ditambahkan di isOperatorValid().
     *
     * @var array<string,list<string>>
     */
    private array $operatorsByType = [
        'string'       => ['=', '!=', 'matches', '!matches', 'starts_with', 'ends_with', 'in', '!in'],
        'number'       => ['=', '!=', '>', '>=', '<', '<=', 'in', '!in', 'between', '!between'],
        'currency'     => ['=', '!=', '>', '>=', '<', '<=', 'in', '!in', 'between', '!between'],
        'time'         => ['=', '!=', '>', '>=', '<', '<=', 'in', '!in', 'between', '!between'],
        'date'         => ['in_period', '!in_period'],
        'datetime'     => ['in_period', '!in_period'],
        'boolean'      => ['=', '!='],
        'relation'     => ['=', '!=', 'in', '!in'],
        'formStatus'   => ['=', '!=', 'in', '!in'],
        'enum'         => ['=', '!=', 'in', '!in'],
        'relations'    => ['has', '!has', 'in', '!in'],
        'formStatuses' => ['has', '!has', 'in', '!in'],
    ];

    private FilterColumnResolver $resolver;

    /** @param array<string,array<string,mixed>> $columns hasil Model::getColumns(), keyed by name */
    public function __construct(private array $columns) {
        $this->resolver = new FilterColumnResolver($columns);
    }

    /**
     * Bersihkan tree: drop item invalid, collapse/drop grup kosong.
     * Mengembalikan tree bersih dengan bentuk { root: group }.
     *
     * @param  array<string,mixed>  $tree
     * @return array<string,mixed>
     */
    public function clean(array $tree): array {
        $root  = $tree['root'] ?? $tree;
        $clean = $this->isGroup($root)
            ? $this->cleanGroup($root)
            : ['k' => 'and', 'c' => []];

        return ['root' => $clean];
    }

    /**
     * Apakah ada minimal satu item valid tersisa setelah clean.
     *
     * @param  array<string,mixed>  $cleanedTree
     */
    public function hasValidItems(array $cleanedTree): bool {
        $root = $cleanedTree['root'] ?? $cleanedTree;

        return $this->countItems($root) > 0;
    }

    /**
     * Bersihkan group secara rekursif. Item gagal validasi di-drop; child
     * group yang kosong setelah clean di-drop; group single-child group
     * di-collapse (anak menggantikan dirinya).
     *
     * @param  array<string,mixed>  $group
     * @return array<string,mixed>
     */
    private function cleanGroup(array $group): array {
        $children   = $group['c'] ?? $group['children'] ?? [];
        $groupKey   = ($group['k'] ?? 'and') === 'or' ? 'or' : 'and';
        $cleanChild = [];

        foreach ($children as $id => $node) {
            if (! is_array($node)) {
                continue;
            }

            if ($this->isGroup($node)) {
                $cleaned = $this->cleanGroup($node);
                $entries = $cleaned['c'];

                if (count($entries) === 0) {
                    continue; // grup kosong → drop
                }

                if (count($entries) === 1) {
                    // collapse: pindahkan satu-satunya anak naik satu level
                    $cleanChild[(string) array_key_first($entries)] = reset($entries);

                    continue;
                }

                $cleanChild[(string) $id] = $cleaned;
            } elseif ($this->isValidItem($node)) {
                $cleanChild[(string) $id] = $node;
            }
        }

        return ['k' => $groupKey, 'c' => $cleanChild];
    }

    /**
     * Hitung jumlah item (non-group) dalam subtree.
     *
     * @param  array<string,mixed>  $node
     */
    private function countItems(array $node): int {
        if (! $this->isGroup($node)) {
            return 1;
        }

        $count = 0;
        foreach (($node['c'] ?? $node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $count += $this->countItems($child);
            }
        }

        return $count;
    }

    /**
     * Validasi satu item: kolom (whitelist + searchable), operator (whitelist),
     * dan value-shape (structural + type-check).
     *
     * @param  array<string,mixed>  $item
     */
    private function isValidItem(array $item): bool {
        $key = $item['k'] ?? null;
        $op  = $item['o'] ?? null;

        if (! is_string($key) || ! is_string($op) || $key === '' || $op === '') {
            return false;
        }

        $column = $this->resolveColumn($key, $item['v'] ?? null);
        if ($column === null || ($column['searchable'] ?? true) === false) {
            return false;
        }
        if (! $this->isOperatorValid($column, $op)) {
            return false;
        }

        return $this->isValueShapeValid($column, $op, $item['v'] ?? null);
    }

    /**
     * Validasi bentuk value sesuai (type kolom, operator). Mirror valueInput
     * di operators.js / ValueField.
     *
     * @param  array<string,mixed>  $column
     */
    private function isValueShapeValid(array $column, string $op, mixed $value): bool {
        // set/!set: tidak butuh value.
        if (in_array($op, ['set', '!set'], true)) {
            return true;
        }

        $type   = $column['type'] ?? 'string';
        $negate = $op !== '!=' && str_starts_with($op, '!');
        $base   = $negate ? substr($op, 1) : $op;

        // Relasi
        if ($type === 'relation') {
            return $base === 'in'
                ? count($this->idList($value)) >= 1
                : $this->hasId($value);
        }
        if ($type === 'relations') {
            return count($this->idList($value)) >= 1;
        }

        // Period (date/datetime)
        if ($base === 'in_period') {
            return $this->isPeriodValid($value);
        }

        // Between (number/currency/time)
        if ($base === 'between') {
            if (! is_array($value) || count($value) !== 2) {
                return false;
            }
            [$a, $b] = array_values($value);
            if (! $this->isFilled($a) || ! $this->isFilled($b)) {
                return false;
            }

            return $type === 'time'
                ? $this->isTime($a) && $this->isTime($b)
                : $this->isNumeric($a) && $this->isNumeric($b);
        }

        // In (semua type list)
        if ($base === 'in') {
            return count($this->scalarList($value)) >= 1;
        }

        // has (relations) sudah ditangani di atas; sisanya skalar.
        if ($type === 'boolean') {
            return true; // checkbox; default false valid
        }

        return match ($type) {
            'number', 'currency' => $this->isNumeric($value),
            'time'               => $this->isTime($value),
            default              => $this->isFilled($value),
        };
    }

    // ---- Value-shape helpers --------------------------------------------

    private function isFilled(mixed $v): bool {
        if ($v === null) {
            return false;
        }
        if (is_array($v)) {
            return count($v) > 0;
        }

        return trim((string) $v) !== '';
    }

    private function isNumeric(mixed $v): bool {
        if ($v === null || (is_string($v) && trim($v) === '')) {
            return false;
        }

        return is_numeric($v);
    }

    private function isTime(mixed $v): bool {
        return is_string($v) && preg_match('/^\d{2}:\d{2}$/', $v) === 1;
    }

    private function hasId(mixed $v): bool {
        return is_array($v) && isset($v['id']) && $v['id'] !== null && $v['id'] !== '';
    }

    /**
     * Daftar value objek ber-id yang terisi.
     *
     * @return list<mixed>
     */
    private function idList(mixed $value): array {
        if (! is_array($value)) {
            return [];
        }
        // single { id }
        if ($this->hasId($value)) {
            return [$value];
        }

        return array_values(array_filter(
            $value,
            fn ($v) => is_array($v) && isset($v['id']) && $v['id'] !== null && $v['id'] !== '',
        ));
    }

    /**
     * Daftar nilai skalar non-kosong (mirror FilterEvaluator::toList).
     *
     * @return list<mixed>
     */
    private function scalarList(mixed $value): array {
        if (is_array($value)) {
            return array_values(array_filter($value, fn ($v) => $v !== null && $v !== ''));
        }
        if (is_string($value)) {
            return array_values(array_filter(array_map('trim', explode(',', $value)), fn ($v) => $v !== ''));
        }

        return $value === null ? [] : [$value];
    }

    /**
     * Validasi struktur period (mirror filterValidation.js dateselector &
     * FilterEvaluator::applyPeriod).
     */
    private function isPeriodValid(mixed $value): bool {
        if (! is_array($value) || empty($value['period']) || empty($value['operator'])) {
            return false;
        }

        $operator = (string) $value['operator'];
        $isRange  = $operator === 'between' || $operator === 'not-between';

        if ($value['period'] === 'day') {
            if (empty($value['startDate']) || ! $this->isDate($value['startDate'])) {
                return false;
            }

            return ! $isRange || (! empty($value['endDate']) && $this->isDate($value['endDate']));
        }

        // Non-day: butuh year (single atau rangeStart/rangeEnd).
        $startYear = $value['rangeStart']['year'] ?? $value['year'] ?? null;
        if ($startYear === null) {
            return false;
        }
        if ($isRange && ($value['rangeEnd']['year'] ?? $value['year'] ?? null) === null) {
            return false;
        }

        return true;
    }

    private function isDate(mixed $v): bool {
        if (! is_string($v) && ! is_numeric($v)) {
            return false;
        }
        try {
            Carbon::parse((string) $v);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    // ---- Column / operator resolution (mirror FilterEvaluator) -----------

    private function isOperatorValid(array $column, string $op): bool {
        if (in_array($op, ['set', '!set'], true)) {
            return true;
        }

        $type    = $column['type'] ?? 'string';
        $allowed = $this->operatorsByType[$type] ?? [];

        return in_array($op, $allowed, true);
    }

    /**
     * Resolusi kolom (dukung dot-notation relasi) dengan lazy-load kolom anak
     * relasi via FilterColumnResolver. `$value` dipakai untuk relasi morph.
     *
     * @return array<string,mixed>|null
     */
    private function resolveColumn(string $key, mixed $value = null): ?array {
        return $this->resolver->resolve($key, $value);
    }

    private function isGroup(mixed $node): bool {
        return is_array($node) && (isset($node['c']) || isset($node['children']));
    }
}
