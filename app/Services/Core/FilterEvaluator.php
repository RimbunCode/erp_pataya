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
    private bool $allowNonSearchable;

    /** @param array<string,array<string,mixed>> $columns hasil Model::getColumns(), keyed by name */
    public function __construct(private array $columns, bool $allowNonSearchable = false) {
        $this->resolver           = new FilterColumnResolver($columns);
        $this->allowNonSearchable = $allowNonSearchable;
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

        $path = $this->resolver->resolvePath($key, $value);
        if ($path === null) {
            return; // kolom tidak ter-resolve
        }
        $column = $path['column'];
        if (! $this->allowNonSearchable && ($column['searchable'] ?? true) === false) {
            return; // whitelist kolom
        }
        if (! $this->isOperatorValid($column, $op, $value)) {
            return; // whitelist operator
        }

        // Column comparison mode: value is { kind: "column", ref: ... }
        if (is_array($value) && ($value['kind'] ?? null) === 'column') {
            $this->applyColumnComparison($query, $path, $op, $value, $boolean);

            return;
        }

        // Key dot-notation pada kolom DALAM relasi (mis. "category.type"):
        // bungkus dalam nested whereHas lalu terapkan kondisi pada kolom akhir
        // memakai nama relatif (tanpa prefix relasi) agar SQL valid.
        if (! empty($path['relations'])) {
            $this->applyNestedRelationColumn($query, $path, $op, $value, $boolean);

            return;
        }

        $type   = $column['type'] ?? 'string';
        $negate = $op !== '!=' && str_starts_with($op, '!');
        $base   = $negate ? substr($op, 1) : $op;

        // Relasi (basic / morph / plural) — filter PADA relasi itu sendiri (by id).
        if (in_array($type, ['relation', 'relations'], true)) {
            $this->applyRelation($query, $column, $base, $negate, $value, $boolean);

            return;
        }

        // formStatuses (JSON array) — whereJsonContains
        if ($type === 'formStatuses') {
            $normBase   = ($base === 'has') ? 'in' : $base;
            $normNegate = ($op === '!has') ? true : $negate;
            $this->applyJsonArray($query, $this->qualifiedColumn($key), $normBase, $normNegate, $value, $boolean);

            return;
        }

        // Period (date/datetime)
        if ($base === 'in_period') {
            $this->applyPeriod($query, $this->qualifiedColumn($key), $type, $value, $negate, $boolean);

            return;
        }

        // Scalar
        $this->applyScalar($query, $this->qualifiedColumn($key), $type, $base, $negate, $value, $boolean);
    }

    /**
     * Terapkan kondisi pada kolom yang berada DI DALAM relasi (dot-notation),
     * membangun nested whereHas dari rantai relasi. Kondisi akhir (scalar /
     * period) diterapkan pada kolom akhir memakai nama relatifnya.
     *
     * @param  array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}  $path
     */
    private function applyNestedRelationColumn(Builder $query, array $path, string $op, mixed $value, string $boolean): void {
        $relations  = $path['relations'];
        $columnName = $path['columnName'];

        $type   = $path['column']['type'] ?? 'string';
        $negate = $op !== '!=' && str_starts_with($op, '!');
        $base   = $negate ? substr($op, 1) : $op;

        // Column comparison mode (right side may also be in a relation).
        if (is_array($value) && ($value['kind'] ?? null) === 'column') {
            $this->applyColumnComparison($query, $path, $op, $value, $boolean);

            return;
        }

        // formStatuses (JSON array) — normalize has→in / !has→!in
        if ($type === 'formStatuses') {
            $base   = ($base === 'has') ? 'in' : $base;
            $negate = ($op === '!has') ? true : $negate;
        }

        // Closure terdalam: kondisi pada kolom akhir (nama relatif terhadap
        // tabel relasi terdalam) — pakai boolean "and" di dalam scope relasi.
        $leaf = function (Builder $q) use ($columnName, $type, $base, $negate, $value): void {
            if ($base === 'in_period') {
                $this->applyPeriod($q, $columnName, $type, $value, $negate, 'and');

                return;
            }
            if ($type === 'formStatuses' && in_array($base, ['in'], true)) {
                $this->applyJsonArray($q, $columnName, $base, $negate, $value, 'and');

                return;
            }
            $this->applyScalar($q, $columnName, $type, $base, $negate, $value, 'and');
        };

        // Bungkus dari relasi terdalam keluar menjadi nested whereHas.
        $callback = $leaf;
        for ($i = count($relations) - 1; $i >= 1; $i--) {
            $rel      = $relations[$i]['function'];
            $inner    = $callback;
            $callback = function (Builder $q) use ($rel, $inner): void {
                $q->whereHas($rel, $inner);
            };
        }

        $outerRelation = $relations[0]['function'];
        $method        = $this->method($boolean, 'whereHas');
        $query->{$method}($outerRelation, $callback);
    }

    // ---- Column comparison handlers -------------------------------------

    /**
     * Bandingkan kolom kiri dengan kolom kanan (mode column).
     * Value berbentuk { kind: "column", ref: <key|key[]> }.
     *
     * @param  array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}  $leftPath
     * @param  array{kind:string,ref:string|list<string>}  $value
     */
    private function applyColumnComparison(Builder $query, array $leftPath, string $op, array $value, string $boolean): void {
        $refs = $value['ref'] ?? null;
        $refs = is_array($refs) ? $refs : ($refs !== null ? [$refs] : []);
        if (empty($refs)) {
            return;
        }

        $leftType = $leftPath['column']['type'] ?? 'string';
        $negate   = $op !== '!=' && str_starts_with($op, '!');
        $base     = $negate ? substr($op, 1) : $op;

        // in_period/set/!set tidak valid di mode column
        if (in_array($base, ['in_period', 'set'], true)) {
            return;
        }

        // Resolve tiap ref; drop yang tidak valid / tidak searchable / tidak type-compat
        $resolvedRefs = [];
        foreach ($refs as $ref) {
            if (! is_string($ref) || $ref === '') {
                continue;
            }
            $refPath = $this->resolver->resolvePath($ref, null);
            if ($refPath === null) {
                continue;
            }
            if (($refPath['column']['searchable'] ?? true) === false) {
                continue;
            }
            $refType = $refPath['column']['type'] ?? 'string';
            if (! $this->isTypeCompatible($leftType, $refType)) {
                continue;
            }
            $resolvedRefs[] = $refPath;
        }
        if (empty($resolvedRefs)) {
            return;
        }

        // Validasi jumlah ref sesuai operator
        $requiredCount = match ($base) {
            'in'      => null, // ≥1
            'between' => 2,
            default   => 1,
        };
        if ($requiredCount !== null && count($resolvedRefs) !== $requiredCount) {
            return;
        }
        if ($base === 'in' && count($resolvedRefs) < 1) {
            return;
        }

        $leftCross  = ! empty($leftPath['relations']);
        $rightCross = false;
        foreach ($resolvedRefs as $rp) {
            if (! empty($rp['relations'])) {
                $rightCross = true;

                break;
            }
        }

        if (! $leftCross && ! $rightCross) {
            $this->applySameTable($query, $leftPath['columnName'], $base, $negate, $resolvedRefs, $boolean);
        } else {
            $this->applyCrossTable($query, $leftPath, $base, $negate, $resolvedRefs, $boolean);
        }
    }

    /**
     * Perbandingan kolom pada tabel yang sama memakai whereColumn.
     *
     * @param  list<array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}>  $refs
     */
    private function applySameTable(Builder $query, string $leftCol, string $base, bool $negate, array $refs, string $boolean): void {
        switch ($base) {
            case 'in':
                $query->{$this->method($boolean, $negate ? 'whereNot' : 'where')}(function (Builder $q) use ($leftCol, $refs) {
                    foreach ($refs as $i => $ref) {
                        $q->whereColumn($leftCol, '=', $ref['columnName'], $i === 0 ? 'and' : 'or');
                    }
                });

                return;
            case 'between':
                if (count($refs) !== 2) {
                    return;
                }
                $query->{$this->method($boolean, $negate ? 'whereNot' : 'where')}(function (Builder $q) use ($leftCol, $refs) {
                    $q->whereColumn($leftCol, '>=', $refs[0]['columnName'])
                        ->whereColumn($leftCol, '<=', $refs[1]['columnName']);
                });

                return;
            default:
                // = != > >= < <=
                $operator = $this->comparisonOperator($base);
                $query->{$this->method($boolean, 'whereColumn')}($leftCol, $operator, $refs[0]['columnName']);
        }
    }

    /**
     * Perbandingan kolom lintas tabel memakai correlated subquery (nested whereHas)
     * dengan nama kolom terkualifikasi tabel agar referensi tabel luar valid.
     *
     * @param  array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}  $leftPath
     * @param  list<array{relations:list<array{function:string,isMorph:bool}>,column:array<string,mixed>,columnName:string}>  $refs
     */
    private function applyCrossTable(Builder $query, array $leftPath, string $base, bool $negate, array $refs, string $boolean): void {
        $baseTableName = $query->getModel()->getTable();
        $leftColName   = $leftPath['columnName'];
        $leftHasRel    = ! empty($leftPath['relations']);

        // Closure kondisi di leaf whereHas — bandingkan kolom terkualifikasi.
        $buildLeaf = function (Builder $q, string $qualifiedLeftCol) use ($base, $negate, $refs): void {
            switch ($base) {
                case 'in':
                    if ($negate) {
                        $q->whereNot(function (Builder $inner) use ($qualifiedLeftCol, $refs) {
                            foreach ($refs as $i => $r) {
                                $rTable = $inner->getModel()->getTable();
                                $rCol   = "{$rTable}.{$r['columnName']}";
                                $inner->whereColumn($qualifiedLeftCol, '=', $rCol, $i === 0 ? 'and' : 'or');
                            }
                        });
                    } else {
                        foreach ($refs as $i => $r) {
                            $rTable = $q->getModel()->getTable();
                            $rCol   = "{$rTable}.{$r['columnName']}";
                            $q->whereColumn($qualifiedLeftCol, '=', $rCol, $i === 0 ? 'and' : 'or');
                        }
                    }

                    return;
                case 'between':
                    if (count($refs) !== 2) {
                        return;
                    }
                    $apply = function (Builder $inner) use ($qualifiedLeftCol, $refs) {
                        $rTable = $inner->getModel()->getTable();
                        $inner->whereColumn($qualifiedLeftCol, '>=', "{$rTable}.{$refs[0]['columnName']}")
                            ->whereColumn($qualifiedLeftCol, '<=', "{$rTable}.{$refs[1]['columnName']}");
                    };
                    if ($negate) {
                        $q->whereNot($apply);
                    } else {
                        $apply($q);
                    }

                    return;
                default:
                    $rTable   = $q->getModel()->getTable();
                    $rightCol = "{$rTable}.{$refs[0]['columnName']}";
                    $operator = $this->comparisonOperator($base);
                    $q->whereColumn($qualifiedLeftCol, $operator, $rightCol);
            }
        };

        // Case 1: Right side in relation → whereHas dari kanan
        $rightHasRel = false;
        foreach ($refs as $rp) {
            if (! empty($rp['relations'])) {
                $rightHasRel = true;

                break;
            }
        }

        if ($rightHasRel) {
            $firstRef  = $refs[0];
            $rightRels = $firstRef['relations'];

            // Qualified left: prefix base table (atau relation table bila kiri juga di relasi)
            if ($leftHasRel) {
                $leftRelTable     = $query->getModel()->getTable();
                $qualifiedLeftCol = "{$leftRelTable}.{$leftColName}";
            } else {
                $qualifiedLeftCol = "{$baseTableName}.{$leftColName}";
            }

            $leaf = function (Builder $q) use ($buildLeaf, $qualifiedLeftCol): void {
                $buildLeaf($q, $qualifiedLeftCol);
            };

            $callback = $leaf;
            for ($i = count($rightRels) - 1; $i >= 1; $i--) {
                $rel      = $rightRels[$i]['function'];
                $inner    = $callback;
                $callback = function (Builder $q) use ($rel, $inner): void {
                    $q->whereHas($rel, $inner);
                };
            }

            $outerRel = $rightRels[0]['function'];
            $method   = $this->method($boolean, 'whereHas');
            $query->{$method}($outerRel, $callback);

            return;
        }

        // Case 2: Left side in relation only → whereHas dari kiri
        if ($leftHasRel) {
            $leftRels = $leftPath['relations'];

            $leaf = function (Builder $q) use ($buildLeaf, $leftColName) {
                // Di dalam whereHas kiri: left col relatif, right col di base table (qualified)
                $buildLeaf($q, $leftColName);
            };

            // Override buildLeaf untuk qualify right column dengan base table
            $buildLeafQualified = function (Builder $q, string $qualifiedLeftCol) use ($base, $negate, $refs, $baseTableName): void {
                switch ($base) {
                    case 'in':
                        if ($negate) {
                            $q->whereNot(function (Builder $inner) use ($qualifiedLeftCol, $refs, $baseTableName) {
                                foreach ($refs as $i => $r) {
                                    $rCol = "{$baseTableName}.{$r['columnName']}";
                                    $inner->whereColumn($qualifiedLeftCol, '=', $rCol, $i === 0 ? 'and' : 'or');
                                }
                            });
                        } else {
                            foreach ($refs as $i => $r) {
                                $rCol = "{$baseTableName}.{$r['columnName']}";
                                $q->whereColumn($qualifiedLeftCol, '=', $rCol, $i === 0 ? 'and' : 'or');
                            }
                        }

                        return;
                    case 'between':
                        if (count($refs) !== 2) {
                            return;
                        }
                        $apply = function (Builder $inner) use ($qualifiedLeftCol, $refs, $baseTableName) {
                            $inner->whereColumn($qualifiedLeftCol, '>=', "{$baseTableName}.{$refs[0]['columnName']}")
                                ->whereColumn($qualifiedLeftCol, '<=', "{$baseTableName}.{$refs[1]['columnName']}");
                        };
                        if ($negate) {
                            $q->whereNot($apply);
                        } else {
                            $apply($q);
                        }

                        return;
                    default:
                        $rightCol = "{$baseTableName}.{$refs[0]['columnName']}";
                        $operator = $this->comparisonOperator($base);
                        $q->whereColumn($qualifiedLeftCol, $operator, $rightCol);
                }
            };

            $leaf = function (Builder $q) use ($buildLeafQualified, $leftColName): void {
                $buildLeafQualified($q, $leftColName);
            };

            $callback = $leaf;
            for ($i = count($leftRels) - 1; $i >= 1; $i--) {
                $rel      = $leftRels[$i]['function'];
                $inner    = $callback;
                $callback = function (Builder $q) use ($rel, $inner): void {
                    $q->whereHas($rel, $inner);
                };
            }

            $outerRel = $leftRels[0]['function'];
            $method   = $this->method($boolean, 'whereHas');
            $query->{$method}($outerRel, $callback);
        }
    }

    // ---- Type compatibility ----------------------------------------------

    /**
     * Cek kompatibilitas type kolom kiri & kanan untuk mode column.
     * Kategori: numeric(number/currency), string, date(date/datetime), time, boolean.
     */
    private function isTypeCompatible(string $leftType, string $rightType): bool {
        $categorize = function (string $type): string {
            return match ($type) {
                'number', 'currency' => 'numeric',
                'string' => 'string',
                'date', 'datetime' => 'date',
                'time'    => 'time',
                'boolean' => 'boolean',
                'relation', 'relations' => 'relation',
                'formStatus', 'formStatuses' => 'status',
                'enum'  => 'enum',
                default => $type,
            };
        };

        return $categorize($leftType) === $categorize($rightType);
    }

    // ---- JSON array handler ----------------------------------------------

    /**
     * Filter kolom JSON array (formStatuses) memakai whereJsonContains.
     * Operator sudah dinormalisasi: has→in, !has→!in.
     */
    private function applyJsonArray(Builder $query, string $col, string $base, bool $negate, mixed $value, string $boolean): void {
        $values = $this->toList($value);
        if (empty($values)) {
            return;
        }

        // base === 'in' (sudah dinormalisasi dari 'has')
        if ($base === 'in') {
            if (! $negate) {
                // in/has: baris yang JSON array-nya memuat minimal salah satu value
                $query->{$this->method($boolean, 'where')}(function (Builder $q) use ($col, $values) {
                    foreach ($values as $i => $v) {
                        $q->whereJsonContains($col, $v, boolean: $i === 0 ? 'and' : 'or');
                    }
                });
            } else {
                // !in/!has: baris yang JSON array-nya tidak memuat satupun value.
                // (tags IS NULL) OR (doesntContain(a) AND doesntContain(b) ...):
                // di MySQL json_contains(NULL,..) = NULL → NOT NULL = NULL, jadi
                // baris NULL tereksklusi tanpa cabang IS NULL eksplisit. Semantik
                // "tidak memuat satupun" mengharuskan NULL/tak-ada ikut match.
                $query->{$this->method($boolean, 'where')}(function (Builder $q) use ($col, $values) {
                    $q->whereNull($col)->orWhere(function (Builder $w) use ($col, $values) {
                        foreach ($values as $v) {
                            $w->whereJsonDoesntContain($col, $v);
                        }
                    });
                });
            }
        }
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
    private function applyPeriod(Builder $query, string $col, string $type, mixed $value, bool $negate, string $boolean): void {
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

        [$start]    = $fromRange;
        [, $end]    = $toRange;
        $startValue = $type === 'date' ? $start->toDateString() : $start;
        $endValue   = $type === 'date' ? $end->toDateString() : $end;

        $apply = function (Builder $q) use ($col, $operator, $startValue, $endValue) {
            match ($operator) {
                'is'           => $q->whereBetween($col, [$startValue, $endValue]),
                'is-not'       => $q->whereNotBetween($col, [$startValue, $endValue]),
                'after'        => $q->where($col, '>', $endValue),
                'on-or-after'  => $q->where($col, '>=', $startValue),
                'before'       => $q->where($col, '<', $startValue),
                'on-or-before' => $q->where($col, '<=', $endValue),
                'between'      => $q->whereBetween($col, [$startValue, $endValue]),
                'not-between'  => $q->whereNotBetween($col, [$startValue, $endValue]),
                default        => $q->whereBetween($col, [$startValue, $endValue]),
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

    private function isOperatorValid(array $column, string $op, mixed $value = null): bool {
        $type = $column['type'] ?? 'string';

        // set/!set universal (tidak valid di mode column)
        $isColumnMode = is_array($value) && ($value['kind'] ?? null) === 'column';
        if (! $isColumnMode && in_array($op, ['set', '!set'], true)) {
            return true;
        }

        $allowed = $this->operatorsByType[$type] ?? [];

        if (in_array($op, $allowed, true)) {
            return true;
        }

        // Mode column: date/datetime menerima operator komparasi penuh
        if ($isColumnMode && in_array($type, ['date', 'datetime'], true)) {
            $columnOps = ['=', '!=', '>', '>=', '<', '<=', 'in', '!in', 'between', '!between'];

            return in_array($op, $columnOps, true);
        }

        return false;
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
