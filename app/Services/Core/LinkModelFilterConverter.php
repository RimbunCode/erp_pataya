<?php

namespace App\Services\Core;

use Illuminate\Support\Str;

/**
 * Mengonversi tree filter format LinkModel menjadi format FilterEvaluator {root:{k,o,v,c}}.
 *
 * Grammar Tree LinkModel (input):
 *
 * @phpstan-type LinkModelFilterTree array<string, mixed>
 *
 * Aturan LinkModel:
 * - Map kolom -> nilai (scalar shorthand untuk operator "=")
 * - Map kolom -> objek operator { "<operator>": <nilai>, ... } (gabung AND)
 * - Key "and" / "or" -> grup boolean bersarang
 * - Key relasi dot-notation "relation.column" -> di-pass ke FilterEvaluator
 * - Key relasi nested-object "relation": { ... } -> di-flatten menjadi dot-notation
 *
 * Grammar Tree FilterEvaluator (output):
 * @phpstan-type FilterBuilderTree array{root: array{k: string, c?: array<string, array{k?: string, o?: string, v?: mixed, c?: array<mixed>}>}}
 *
 * Aturan Konversi Operator:
 * LinkModel -> FilterEvaluator
 * = / equal -> =
 * != / not / notEqual -> !=
 * > / >= / < / <= -> sama
 * in -> in
 * notIn -> !in
 * between -> between
 * notBetween -> !between
 * like -> matches
 * notLike -> !matches
 * matches / starts_with / ends_with / has / !has / set / !set / in_period -> identitas
 */
class LinkModelFilterConverter {
    private FilterColumnResolver $resolver;

    /**
     * @param  array<string,array<string,mixed>>|list<array<string,mixed>>  $columns  Hasil Model::getColumns()
     */
    public function __construct(private array $columns) {
        $this->resolver = new FilterColumnResolver($columns);
    }

    /**
     * Konversi tree LinkModel menjadi format {root:{k,c}} untuk FilterEvaluator.
     *
     * @param  array<string, mixed>  $linkFilters
     * @param  string  $boolean  'and' atau 'or'
     * @return array{root: array{k: string, c: array<string, mixed>}}
     */
    public function toTree(array $linkFilters, string $boolean = 'and'): array {
        $children = $this->parseGroup($linkFilters);

        return [
            'root' => [
                'k' => $boolean,
                'c' => $children,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function parseGroup(array $filters): array {
        $children = [];

        foreach ($filters as $key => $value) {
            $keyStr   = (string) $key;
            $lowerKey = strtolower($keyStr);

            // Boolean group: and / or
            if ($lowerKey === 'and' || $lowerKey === 'or') {
                if (is_array($value)) {
                    $id            = $this->generateId();
                    $children[$id] = [
                        'k' => $lowerKey,
                        'c' => $this->parseGroup($value),
                    ];
                }

                continue;
            }

            // Cek apakah raw(...)
            if (Str::startsWith($keyStr, 'raw(')) {
                // Di luar grammar FilterEvaluator, skip + dev-note
                continue;
            }

            // Flatten nested relation: customer: { type: "A" } -> customer.type: "A"
            if (is_array($value) && $this->isRelationNode($keyStr)) {
                // Cek apakah isian array itu by-id (misal operator) atau relasi by-id
                // Relasi by-id (= atau in) value diteruskan apa adanya
                // Tapi jika key-nya berupa nama operator, dia bukan flatten relation
                if (! empty($value) && ! array_is_list($value) && ! $this->hasOperatorKeys($value)) {
                    $flattened = $this->flattenRelation($keyStr, $value);
                    $parsed    = $this->parseGroup($flattened);
                    foreach ($parsed as $childId => $childNode) {
                        $children[$childId] = $childNode;
                    }

                    continue;
                }
            }

            // Normal kolom
            $items = $this->parseColumn($keyStr, $value);
            foreach ($items as $item) {
                $id            = $this->generateId();
                $children[$id] = $item;
            }
        }

        return $children;
    }

    /**
     * Flatten relasi: ["customer" => ["type" => "A", "status" => "B"]] -> ["customer.type" => "A", "customer.status" => "B"]
     *
     * @param  array<string, mixed>  $value
     * @return array<string, mixed>
     */
    private function flattenRelation(string $prefix, array $value): array {
        $result = [];
        foreach ($value as $k => $v) {
            // Jika ada nested lagi, biarkan recursive group handle atau parseColumn yg handle
            // karena parseGroup bisa call flattenRelation berulang
            $result[$prefix . '.' . $k] = $v;
        }

        return $result;
    }

    /**
     * Parse kondisi kolom
     *
     * @return list<array{k?: string, o?: string, v?: mixed, c?: array<mixed>}>
     */
    private function parseColumn(string $key, mixed $value): array {
        // Empty array (mis. {} dari JSON dengan semua value undefined) → skip
        if (is_array($value) && empty($value)) {
            return [];
        }

        // Scalar value -> shorthand untuk '='
        if (! is_array($value) || array_is_list($value) || (isset($value['id']) && count(array_intersect_key($value, array_flip(['id', 'type']))) > 0)) {
            // Relasi by-id ({id:...} atau list) juga diteruskan sebagai '='
            $op   = '=';
            $val  = $value;
            $item = $this->mapItem($key, $op, $val);

            return $item !== null ? [$item] : [];
        }

        // Object operator
        $items = [];
        foreach ($value as $opKey => $val) {
            $opKeyStr   = (string) $opKey;
            $lowerOpKey = strtolower($opKeyStr);

            // "and" / "or" dalam operator object → parse $val sebagai operator-map untuk $key (rekursif)
            if ($lowerOpKey === 'and' || $lowerOpKey === 'or') {
                if (is_array($val)) {
                    $nested = $this->parseOperatorGroup($key, $val);
                    if (! empty($nested)) {
                        $items[] = ['k' => $lowerOpKey, 'c' => $nested];
                    }
                }

                continue;
            }

            // Skip operator yang butuh list/range bila value-nya kosong
            $needsNonEmpty = ['in', 'notIn', 'between', 'notBetween'];
            if (in_array($opKeyStr, $needsNonEmpty, true) && is_array($val) && empty($val)) {
                continue;
            }

            $item = $this->mapItem($key, $opKeyStr, $val);
            if ($item !== null) {
                $items[] = $item;
            }
        }

        if (count($items) > 1) {
            // Jika lebih dari 1 operator, bungkus dalam AND
            $groupChildren = [];
            foreach ($items as $item) {
                $groupChildren[$this->generateId()] = $item;
            }

            return [
                [
                    'k' => 'and',
                    'c' => $groupChildren,
                ],
            ];
        }

        return $items;
    }

    /**
     * Parse operator-map untuk satu kolom secara rekursif, mendukung nested and/or.
     * Single-child group di-unwrap langsung tanpa wrapper group node.
     *
     * @param  array<string, mixed>  $ops
     * @return array<string, mixed>
     */
    private function parseOperatorGroup(string $key, array $ops): array {
        $subItems = [];

        foreach ($ops as $opKey => $val) {
            $lowerOp = strtolower((string) $opKey);

            // Nested and/or → rekursi
            if ($lowerOp === 'and' || $lowerOp === 'or') {
                if (is_array($val)) {
                    $nested = $this->parseOperatorGroup($key, $val);
                    if (! empty($nested)) {
                        if (count($nested) === 1) {
                            // Unwrap single-child — tidak perlu wrap group
                            foreach ($nested as $id => $child) {
                                $subItems[$id] = $child;
                            }
                        } else {
                            $subItems[$this->generateId()] = ['k' => $lowerOp, 'c' => $nested];
                        }
                    }
                }

                continue;
            }

            // Skip operator yang butuh list/range bila value-nya kosong
            $needsNonEmpty = ['in', 'notIn', 'between', 'notBetween'];
            if (in_array((string) $opKey, $needsNonEmpty, true) && is_array($val) && empty($val)) {
                continue;
            }

            $item = $this->mapItem($key, (string) $opKey, $val);
            if ($item !== null) {
                $subItems[$this->generateId()] = $item;
            }
        }

        return $subItems;
    }

    /**
     * Map operator & konversi date -> in_period
     *
     * @return array{k?: string, o?: string, v?: mixed, c?: array<mixed>}|null
     */
    private function mapItem(string $key, string $operator, mixed $value): ?array {
        if ($operator === 'column') {
            $innerOp = '=';
            $ref     = $value;
            if (is_array($value) && count($value) === 1) {
                $innerOpKey    = array_key_first($value);
                $mappedInnerOp = $this->mapOperator((string) $innerOpKey);
                if ($mappedInnerOp !== null) {
                    $innerOp = $mappedInnerOp;
                    $ref     = $value[$innerOpKey];
                }
            }

            return [
                'k' => $key,
                'o' => $innerOp,
                'v' => [
                    'kind' => 'column',
                    'ref'  => $ref,
                ],
            ];
        }

        $colNode = $this->resolver->resolve($key);
        $type    = $colNode['type'] ?? 'string';

        if ($type === 'date' || $type === 'datetime') {
            return $this->mapDatePeriod($key, $operator, $value);
        }

        if ($operator === 'jsonContains' || $operator === 'jsonDoesntContains') {
            if ($key === 'formStatuses' || ($colNode['name'] ?? '') === 'formStatuses') {
                $mappedOp = $operator === 'jsonContains' ? 'has' : '!has';

                return ['k' => $key, 'o' => $mappedOp, 'v' => $value];
            } else {
                // skip + dev-note
                return null;
            }
        }

        $mappedOp = $this->mapOperator($operator);

        // Jika skip
        if ($mappedOp === null) {
            return null;
        }

        return ['k' => $key, 'o' => $mappedOp, 'v' => $value];
    }

    private function mapDatePeriod(string $key, string $operator, mixed $value): ?array {
        $mapped = match ($operator) {
            '>'  => ['in_period', 'after'],
            '>=' => ['in_period', 'on-or-after'],
            '<'  => ['in_period', 'before'],
            '<=' => ['in_period', 'on-or-before'],
            '=', 'equal' => ['in_period', 'is'],
            'not', '!=', 'notEqual' => ['!in_period', 'is'],
            'between'    => ['in_period', 'between'],
            'notBetween' => ['!in_period', 'between'],
            default      => null, // in/notIn atau lainnya -> skip
        };

        if ($mapped === null) {
            return null; // Skip
        }

        [$filterOp, $periodOp] = $mapped;

        $periodValue = [
            'period'   => 'day',
            'operator' => $periodOp,
        ];

        if ($periodOp === 'between') {
            if (is_array($value) && count($value) >= 2) {
                $periodValue['startDate'] = $value[0];
                $periodValue['endDate']   = $value[1];
            } else {
                return null; // Invalid between value
            }
        } else {
            $periodValue['startDate'] = $value;
        }

        return [
            'k' => $key,
            'o' => $filterOp,
            'v' => $periodValue,
        ];
    }

    private function mapOperator(string $operator): ?string {
        return match ($operator) {
            '=', '==', 'equal' => '=',
            '!=', 'not', 'notEqual' => '!=',
            '>', '>=', '<', '<=' => $operator,
            'in'         => 'in',
            'notIn'      => '!in',
            'between'    => 'between',
            'notBetween' => '!between',
            'like'       => 'matches',
            'notLike'    => '!matches',
            'matches', 'starts_with', 'ends_with', 'has', '!has', 'set', '!set', 'in_period', '!in_period' => $operator,
            default => null, // Skip tak dikenal
        };
    }

    private function isRelationNode(string $key): bool {
        $colNode = $this->resolver->resolve($key);
        if ($colNode === null) {
            return false;
        }
        $type = $colNode['type'] ?? null;

        return in_array($type, ['relation', 'relations'], true);
    }

    /**
     * Mengecek apakah dictionary value isinya dominan operator
     */
    private function hasOperatorKeys(array $value): bool {
        $knownOperators = [
            '=', '==', 'equal', '!=', 'not', 'notEqual', '>', '>=', '<', '<=',
            'in', 'notIn', 'between', 'notBetween', 'like', 'notLike',
            'matches', 'starts_with', 'ends_with', 'has', '!has', 'set', '!set', 'in_period', '!in_period',
            'and', 'or', 'column',
        ];

        foreach (array_keys($value) as $k) {
            if (in_array((string) $k, $knownOperators, true)) {
                return true;
            }
        }

        return false;
    }

    private function generateId(): string {
        return Str::random(8);
    }
}
