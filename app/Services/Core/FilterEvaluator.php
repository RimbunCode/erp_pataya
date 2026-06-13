<?php

namespace App\Services\Core;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

/**
 * Mengkonsumsi filter tree (mini-DSL produksi FilterBuilder frontend) menjadi
 * kondisi query Eloquent secara rekursif.
 *
 * Reusable & DI murni: tidak bergantung pada Request/cookie/session/Inertia.
 * Pemanggil menyuntik metadata kolom (dari Model::getColumns()) dan tree.
 *
 * Grammar:
 *   tree  = { root: group } | group
 *   group = { k: "and"|"or", c: { <id>: group|item } }
 *   item  = { k: <column>, o: <operator>, v: <value> }
 *
 * @phpstan-type Node array<string,mixed>
 */
class FilterEvaluator {
    /**
     * Operator yang valid per kategori type kolom (mirror operators.js).
     * Operator universal (set/!set) ditambahkan di isOperatorValid().
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
     * Terapkan filter tree ke query. Chainable, tidak mengeksekusi.
     */
    public function apply(Builder $query, array $tree): Builder {
        $root = $tree['root'] ?? $tree;

        if (! $this->isGroup($root)) {
            return $query;
        }

        $query->where(function (Builder $q) use ($root) {
            $this->applyGroup($q, $root);
        });

        return $query;
    }

    /**
     * Terapkan sebuah group (rekursif). Node pertama selalu boolean "and"
     * relatif terhadap group; sisanya memakai operator group (k).
     *
     * @param  array<string,mixed>  $group
     */
    private function applyGroup(Builder $query, array $group): void {
        $children  = $group['c'] ?? $group['children'] ?? [];
        $groupBool = ($group['k'] ?? 'and') === 'or' ? 'or' : 'and';

        $first = true;
        foreach ($children as $node) {
            if (! is_array($node)) {
                continue;
            }
            $boolean = $first ? 'and' : $groupBool;
            $first   = false;

            if ($this->isGroup($node)) {
                $query->where(function (Builder $q) use ($node) {
                    $this->applyGroup($q, $node);
                }, null, null, $boolean);
            } else {
                $this->applyItem($query, $node, $boolean);
            }
        }
    }

    /**
     * Terapkan satu item filter. Item invalid (kolom/operator) di-skip diam-diam.
     *
     * @param  array<string,mixed>  $item
     */
    private function applyItem(Builder $query, array $item, string $boolean): void {
        $key   = $item['k'] ?? null;
        $op    = $item['o'] ?? null;
        $value = $item['v'] ?? null;

        if (! is_string($key) || ! is_string($op)) {
            return;
        }

        $column = $this->resolveColumn($key, $value);
        if ($column === null || ($column['searchable'] ?? true) === false) {
            return; // whitelist kolom
        }
        if (! $this->isOperatorValid($column, $op)) {
            return; // whitelist operator
        }

        $type   = $column['type'] ?? 'string';
        $negate = $op !== '!=' && str_starts_with($op, '!');
        $base   = $negate ? substr($op, 1) : $op;

        // Relasi (basic / morph / plural)
        if (in_array($type, ['relation', 'relations'], true)) {
            $this->applyRelation($query, $column, $base, $negate, $value, $boolean);

            return;
        }

        // Period (date/datetime)
        if ($base === 'in_period') {
            $this->applyPeriod($query, $this->qualifiedColumn($key), $value, $negate, $boolean);

            return;
        }

        // Scalar
        $this->applyScalar($query, $this->qualifiedColumn($key), $type, $base, $negate, $value, $boolean);
    }

    // ---- Scalar handlers ------------------------------------------------

    /**
     * @param  array<string,mixed>|string|int|float|bool|null  $value
     */
    private function applyScalar(Builder $query, string $col, string $type, string $base, bool $negate, mixed $value, string $boolean): void {
        switch ($base) {
            case 'set':
                $this->applySet($query, $col, $type, $negate, $boolean);

                return;
            case 'in':
                $values = $this->toList($value);
                $query->{$this->method($boolean, $negate ? 'whereNotIn' : 'whereIn')}($col, $values);

                return;
            case 'between':
                $range = $this->toList($value);
                if (count($range) === 2) {
                    $query->{$this->method($boolean, $negate ? 'whereNotBetween' : 'whereBetween')}($col, array_values($range));
                }

                return;
            case 'matches':
                $this->applyLike($query, $col, "%{$value}%", $negate, $boolean);

                return;
            case 'starts_with':
                $this->applyLike($query, $col, "{$value}%", false, $boolean);

                return;
            case 'ends_with':
                $this->applyLike($query, $col, "%{$value}", false, $boolean);

                return;
            default:
                // = != > >= < <= (base bisa "=" atau, untuk "!=", base tetap "!=")
                $operator   = $this->comparisonOperator($base);
                $normalized = $this->normalizeScalar($type, $value);
                $query->where($col, $operator, $normalized, $boolean);
        }
    }

    private function applySet(Builder $query, string $col, string $type, bool $negate, string $boolean): void {
        if ($type === 'string') {
            // not_set (negate): NULL OR '' ; set: NOT NULL AND != ''
            $query->where(function (Builder $q) use ($col, $negate) {
                if ($negate) {
                    $q->whereNull($col)->orWhere($col, '=', '');
                } else {
                    $q->whereNotNull($col)->where($col, '!=', '');
                }
            }, null, null, $boolean);

            return;
        }

        $query->{$this->method($boolean, $negate ? 'whereNull' : 'whereNotNull')}($col);
    }

    private function applyLike(Builder $query, string $col, string $pattern, bool $negate, string $boolean): void {
        $query->where($col, $negate ? 'not like' : 'like', $pattern, $boolean);
    }

    // ---- Relation handlers ----------------------------------------------

    /**
     * @param  array<string,mixed>  $column
     */
    private function applyRelation(Builder $query, array $column, string $base, bool $negate, mixed $value, string $boolean): void {
        $relation = $column['nameOfFunction'] ?? $column['name'] ?? null;
        if (! is_string($relation)) {
            return;
        }

        $isMorph = ($column['typeRelation'] ?? 'basic') === 'morph';

        // has / !has → existence
        if ($base === 'has') {
            $method = $negate ? 'whereDoesntHave' : 'whereHas';
            $query->{$this->method($boolean, $method)}($relation);

            return;
        }

        // set / !set → existence of related row
        if ($base === 'set') {
            $method = $negate ? 'whereDoesntHave' : 'whereHas';
            $query->{$this->method($boolean, $method)}($relation);

            return;
        }

        $relatedKey = $column['primaryKey'] ?? 'id';

        if ($isMorph) {
            $this->applyMorph($query, $relation, $negate, $value, $boolean);

            return;
        }

        // basic: filter pada primary key related lewat whereHas.
        // Value bisa berupa objek record {id,...} (single) atau list objek (in);
        // ekstrak id via scalarId agar whereIn menerima skalar.
        $ids = $base === 'in'
            ? array_map(fn ($v) => $this->scalarId($v), $this->toList($value))
            : [$this->scalarId($value)];
        $ids    = array_values(array_filter($ids, fn ($v) => $v !== null && $v !== ''));
        $method = $negate ? 'whereDoesntHave' : 'whereHas';
        $query->{$this->method($boolean, $method)}($relation, function (Builder $q) use ($relatedKey, $ids) {
            $q->whereIn($relatedKey, $ids);
        });
    }

    private function applyMorph(Builder $query, string $relation, bool $negate, mixed $value, string $boolean): void {
        // value: { type, id } atau array of { type, id }
        $pairs = $this->toMorphPairs($value);
        if (empty($pairs)) {
            return;
        }

        $method = $negate ? 'whereDoesntHave' : 'whereHas';
        $query->{$this->method($boolean, $method)}($relation, function (Builder $q) use ($pairs) {
            $q->where(function (Builder $inner) use ($pairs) {
                foreach ($pairs as $pair) {
                    $inner->orWhere($inner->getModel()->getKeyName(), $pair['id']);
                }
            });
        });
    }

    // ---- Period handler -------------------------------------------------

    /**
     * Value shape (selaras komponen reui DateSelector):
     *   {
     *     period:   "day"|"month"|"quarter"|"half-year"|"year",
     *     operator: "is"|"is-not"|"before"|"on-or-before"|"after"|"on-or-after"|"between"|"not-between",
     *     startDate?, endDate?: ISO string (period=day),
     *     year?, month?, quarter?, halfYear?: int (period non-day, *index 0-based*),
     *     rangeStart?, rangeEnd?: { year:int, value:int } (operator range non-day)
     *   }
     *
     * @param  array<string,mixed>  $value
     */
    private function applyPeriod(Builder $query, string $col, mixed $value, bool $negate, string $boolean): void {
        if (! is_array($value) || empty($value['period']) || empty($value['operator'])) {
            return;
        }

        $period   = (string) $value['period'];
        $operator = (string) $value['operator'];
        $isRange  = $operator === 'between' || $operator === 'not-between';

        // Resolusi batas awal (from) dan akhir (to).
        $fromRange = $this->resolvePeriodBounds($period, $value, false);
        $toRange   = $isRange
            ? $this->resolvePeriodBounds($period, $value, true)
            : $fromRange;

        if ($fromRange === null || $toRange === null) {
            return;
        }

        [$start] = $fromRange;
        [, $end] = $toRange;

        $apply = function (Builder $q) use ($col, $operator, $start, $end) {
            match ($operator) {
                'is'           => $q->whereBetween($col, [$start, $end]),
                'is-not'       => $q->whereNotBetween($col, [$start, $end]),
                'after'        => $q->where($col, '>', $end),
                'on-or-after'  => $q->where($col, '>=', $start),
                'before'       => $q->where($col, '<', $start),
                'on-or-before' => $q->where($col, '<=', $end),
                'between'      => $q->whereBetween($col, [$start, $end]),
                'not-between'  => $q->whereNotBetween($col, [$start, $end]),
                default        => $q->whereBetween($col, [$start, $end]),
            };
        };

        if ($negate) {
            $query->whereNot(function (Builder $q) use ($apply) {
                $apply($q);
            }, null, null, $boolean);
        } else {
            $query->where(function (Builder $q) use ($apply) {
                $apply($q);
            }, null, null, $boolean);
        }
    }

    /**
     * Hitung [start, end] Carbon untuk batas periode. `$end=true` mengambil
     * batas akhir (rangeEnd / endDate); selain itu batas awal.
     *
     * @param  array<string,mixed>  $value
     * @return array{0:Carbon,1:Carbon}|null
     */
    private function resolvePeriodBounds(string $period, array $value, bool $end): ?array {
        try {
            if ($period === 'day') {
                $iso = $end ? ($value['endDate'] ?? $value['startDate'] ?? null) : ($value['startDate'] ?? null);
                if ($iso === null) {
                    return null;
                }
                $dt = Carbon::parse((string) $iso);

                // Time mempersempit batas (presisi menit) bila ada komponen waktu
                // non-midnight; jika tidak, pakai batas seluruh hari (perilaku
                // date murni). Mapping operator di applyPeriod memakai
                // [start]=fromRange, [end]=toRange.
                $hasTime = $dt->hour !== 0 || $dt->minute !== 0 || $dt->second !== 0;
                if ($hasTime) {
                    return [$dt->copy()->startOfMinute(), $dt->copy()->endOfMinute()];
                }

                return [$dt->copy()->startOfDay(), $dt->copy()->endOfDay()];
            }

            // Non-day: ambil year + index unit dari single atau range.
            $range = $end ? ($value['rangeEnd'] ?? null) : ($value['rangeStart'] ?? null);
            $year  = $range['year'] ?? $value['year'] ?? null;
            if ($year === null) {
                return null;
            }
            $year = (int) $year;

            return match ($period) {
                'year'      => $this->yearRange($year),
                'half-year' => $this->halfYearRange($year, (int) ($range['value'] ?? $value['halfYear'] ?? 0)),
                'quarter'   => $this->quarterRange($year, (int) ($range['value'] ?? $value['quarter'] ?? 0)),
                'month'     => $this->monthRange($year, (int) ($range['value'] ?? $value['month'] ?? 0)),
                default     => null,
            };
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array{0:Carbon,1:Carbon} */
    private function yearRange(int $year): array {
        $start = Carbon::create($year, 1, 1)->startOfDay();

        return [$start, $start->copy()->endOfYear()];
    }

    /**
     * @param  int  $half  index 0-based (0 = H1, 1 = H2)
     * @return array{0:Carbon,1:Carbon}
     */
    private function halfYearRange(int $year, int $half): array {
        $startMonth = $half === 1 ? 7 : 1;
        $start      = Carbon::create($year, $startMonth, 1)->startOfDay();

        return [$start, $start->copy()->addMonths(5)->endOfMonth()];
    }

    /**
     * @param  int  $quarter  index 0-based (0 = Q1 .. 3 = Q4)
     * @return array{0:Carbon,1:Carbon}
     */
    private function quarterRange(int $year, int $quarter): array {
        $startMonth = $quarter * 3 + 1;
        $start      = Carbon::create($year, $startMonth, 1)->startOfDay();

        return [$start, $start->copy()->addMonths(2)->endOfMonth()];
    }

    /**
     * @param  int  $month  index 0-based (0 = Januari .. 11 = Desember)
     * @return array{0:Carbon,1:Carbon}
     */
    private function monthRange(int $year, int $month): array {
        $start = Carbon::create($year, $month + 1, 1)->startOfMonth();

        return [$start, $start->copy()->endOfMonth()];
    }

    // ---- Column resolution ----------------------------------------------

    /**
     * Resolusi kolom (dukung dot-notation relasi "category.type") dengan
     * lazy-load kolom anak relasi via FilterColumnResolver. `$value` dipakai
     * untuk relasi morph (ambil FQCN dari value.type).
     *
     * @return array<string,mixed>|null
     */
    private function resolveColumn(string $key, mixed $value = null): ?array {
        return $this->resolver->resolve($key, $value);
    }

    private function isOperatorValid(array $column, string $op): bool {
        $type = $column['type'] ?? 'string';

        // set/!set universal
        if (in_array($op, ['set', '!set'], true)) {
            return true;
        }

        $allowed = $this->operatorsByType[$type] ?? [];

        return in_array($op, $allowed, true);
    }

    // ---- Helpers --------------------------------------------------------

    private function isGroup(mixed $node): bool {
        return is_array($node) && (isset($node['c']) || isset($node['children']));
    }

    /**
     * Qualified column name dengan nama tabel bila belum berkualifikasi.
     */
    private function qualifiedColumn(string $key): string {
        return $key;
    }

    private function comparisonOperator(string $base): string {
        // base sudah berupa operator komparasi langsung (=, !=, >, >=, <, <=)
        return $base;
    }

    /**
     * Gabungkan boolean (and/or) dengan nama method where*.
     * "whereIn" + "or" → "orWhereIn".
     */
    private function method(string $boolean, string $whereMethod): string {
        if ($boolean === 'or') {
            return 'or' . ucfirst($whereMethod);
        }

        return $whereMethod;
    }

    /**
     * @return list<mixed>
     */
    private function toList(mixed $value): array {
        if (is_array($value)) {
            return array_values(array_filter($value, fn ($v) => $v !== null && $v !== ''));
        }
        if (is_string($value)) {
            return array_values(array_filter(array_map('trim', explode(',', $value)), fn ($v) => $v !== ''));
        }

        return $value === null ? [] : [$value];
    }

    private function normalizeScalar(string $type, mixed $value): mixed {
        if ($type === 'boolean') {
            return match ($value) {
                'true', true, 1, '1' => true,
                'false', false, 0, '0' => false,
                default => (bool) $value,
            };
        }

        return $value;
    }

    private function scalarId(mixed $value): mixed {
        if (is_array($value)) {
            return $value['id'] ?? reset($value);
        }

        return $value;
    }

    /**
     * @return list<array{type:?string,id:mixed}>
     */
    private function toMorphPairs(mixed $value): array {
        if (! is_array($value)) {
            return [];
        }
        // single { type, id }
        if (isset($value['id'])) {
            return [['type' => $value['type'] ?? null, 'id' => $value['id']]];
        }
        // list of pairs
        $pairs = [];
        foreach ($value as $item) {
            if (is_array($item) && isset($item['id'])) {
                $pairs[] = ['type' => $item['type'] ?? null, 'id' => $item['id']];
            }
        }

        return $pairs;
    }
}
