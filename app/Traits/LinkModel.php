<?php

namespace App\Traits;

use App\Casts\FormStatusCast;
use App\Casts\FormStatusesCast;
use App\Casts\Json;
use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Scopes\DataTableScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

trait LinkModel {
    protected $defaultConfigColumns = [];

    protected static function bootLinkModel() {
        static::addGlobalScope(new DataTableScope);
    }

    public function initializeLinkModel() {
        $this->defaultConfigColumns = array_merge([
            'created_at' => [
                'titleTrans' => 'core.form.created_at',
            ],
            'updated_at' => [
                'titleTrans' => 'core.form.updated_at',
            ],
            'deleted_at' => [
                'titleTrans' => 'core.form.deleted_at',
            ],
            'canceled_at' => [
                'titleTrans' => 'core.form.canceled_at',
            ],
            'submitted_at' => [
                'titleTrans' => 'core.form.submitted_at',
            ],
            'logs' => [
                'titleTrans' => 'core.form.logs',
                'filter'     => [
                    'type' => 'comment',
                ],
            ],
            'tags' => [
                'titleTrans' => 'core.form.tags',
            ],
            'files' => [
                'titleTrans' => 'core.form.files',
            ],
            'have_transactions' => [
                'ignore' => true,
            ],
            'createdBy' => [
                'titleTrans' => 'core.form.created_by',
            ],
            'status' => [
                'titleTrans' => 'core.form.status',
                'width'      => 'minimum',
                'valueTrans' => 'status',
            ],
            'branch' => [
                'titleTrans' => 'core.branch.branch',
            ],
            'templateLink' => [
                'ignore' => true,
            ],
            'additional_data' => [
                'ignore' => true,
            ],
            'amendedFrom' => [
                'titleTrans' => 'core.form.amended_from',
            ],
            'revision_number' => [
                'ignore' => true,
            ],
            'lft' => [
                'ignore' => true,
            ],
            'rgt' => [
                'ignore' => true,
            ],
            'depth' => [
                'ignore' => true,
            ],
            'appendStatus' => [
                'ignore' => true,
            ],
        ]);
    }

    /**
     * Jika model ini untuk form yang submitable
     *
     * @var bool
     */
    // protected static bool $is_submitable;
    public function isSubmitable() {
        return static::$is_submitable ?? false;
    }

    protected static function loadRelationsOnShow() {
        return [];
    }

    public static function getRelationKeys(bool $filterCustomRelation = true, array $relations = []) {
        $defaultRelations = [
            ...static::loadRelationsOnShow() ?? [],
            ...((static::$is_submitable ?? false) ? ['approvalable', 'amendedFrom'] : []),
        ];
        $relations = (\is_string($relations) ? [$relations] : ($relations ?? []));
        $relations = [...$defaultRelations, ...$relations];

        $instance = new static;
        $toLoad   = [];

        $alreadyLoaded = [];

        foreach ($relations as $key => $relation) {
            $relationName = \is_int($key) ? $relation : $key;
            if (isset($alreadyLoaded[$relationName])) {
                continue;
            }
            $alreadyLoaded[$relationName] = true;

            if (! method_exists($instance, $relationName)) {
                $toLoad[$key] = $relation;

                continue;
            }

            $result = $instance->$relationName();

            if ($result instanceof Relation) {
                $toLoad[$key] = $relation;
            } elseif (! $filterCustomRelation) {
                $instance->setRelation($relationName, $result);
            }
        }

        return $toLoad;
    }

    public function updateHaveTransactions(bool $value = true, bool $save = true) {
        $this->have_transactions = $value;
        if ($save) {
            $this->save();
        }
    }

    protected function getArrayableAppends() {
        $this->appends = array_unique(array_merge(
            $this->appends,
            ['route', 'canDelete', 'keyModel', 'appendStatus', 'thisModel'],
            \method_exists(static::class, 'templateLink') ? ['templateLink'] : [],
            \method_exists(static::class, 'disabledOn') ? ['disabledOn'] : [],
        ));

        return parent::getArrayableAppends();
    }

    protected function getThisModelAttribute() {
        return static::class;
    }

    /**
     * Summary of appendStatus
     *
     * @return FormStatus | FormStatus[]
     */
    protected function appendStatus() {
        return [];
    }

    protected function getAppendStatusAttribute() {
        $baseStatus = $this->status;
        $baseStatus = $baseStatus instanceof FormStatus ? [$baseStatus] : ($baseStatus ?? []);

        $append = $this->appendStatus();
        $append = $append instanceof FormStatus ? [$append] : ($append ?? []);

        return collect($baseStatus)
            ->merge($append)
            ->filter()
            ->unique(fn ($s) => $s instanceof FormStatus ? $s->value : $s)
            ->values()
            ->all();
    }

    protected function getKeyModelAttribute() {
        return \get_class($this) . '-' . $this->id;
    }

    protected function getCanDeleteAttribute(): bool {
        $condition = (static::$is_submitable ?? false) ? \in_array(FormStatus::DRAFT, (array) $this->status) : ! ($this->have_transactions ?? false);
        if (! \method_exists(static::class, 'canDelete')) {
            return $condition;
        }

        return $condition && $this->canDelete();
    }

    protected function getTemplateLinkAttribute(): string {
        if (! \method_exists(static::class, 'templateLink')) {
            return '';
        }

        return static::templateLink();
    }

    protected function getDisabledOnAttribute(): string {
        if (! \method_exists(static::class, 'disabledOn')) {
            return '';
        }

        return static::disabledOn();
    }

    protected function getRouteAttribute() {
        return Str::plural($this->getNameClass());
    }

    public function getNameClass() {
        return Str::camel(Str::afterLast(static::class, '\\'));
    }

    public static function getTableName() {
        return with(new static)->getTable();
    }

    public function parentRelation() {
        $relation = static::$parentRelation ??false;
        if ($relation) {
            return $this->$relation();
        }
        return null;
    }

    public function connections() {
        if ($this->getKey() === null) {
            return ModelConnection::query()->whereRaw('1 = 0');
        }

        return ModelConnection::search(static::class, $this->getKey());
    }

    private static function parseColumnType(array $dataColumn, array $casts) {
        $definition = $dataColumn['type'];
        // Regex:
        // - Group 1: nama tipe (varchar, int, enum, dll)
        // - Group 2: isi di dalam kurung (bisa angka atau opsi enum/set)
        // - Group 3: unsigned (opsional)
        preg_match('/^([a-zA-Z]+)(?:\((.*?)\))?(?:\s+unsigned)?$/i', $definition, $matches);

        $type     = strtolower($matches[1] ?? 'unknown');
        $inside   = $matches[2] ?? '';
        $unsigned = str_contains(strtolower($definition), 'unsigned');

        $length    = 0;
        $precision = 0;
        $scale     = 0;
        $options   = [];

        if ($inside !== '') {
            if (in_array($type, ['enum', 'set'])) {
                // Pecah opsi enum/set jadi array
                preg_match_all("/'([^']*)'/", $inside, $optMatches);
                $options = $optMatches[1] ?? [];
            } elseif (preg_match('/^(\d+)(?:,(\d+))?$/', $inside, $numMatch)) {
                // Numeric (precision, scale)
                $length    = (int) ($numMatch[1] ?? 0);
                $precision = $length;
                $scale     = (int) ($numMatch[2] ?? 0);
            }
        }
        // Mapping pakai match
        $phpType = match ($type) {
            'int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'float', 'double', 'real', 'year' => 'number',
            'varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set'                    => 'string',
            'date'                                                                                            => 'date',
            'datetime', 'timestamp'                                                                           => 'datetime',
            'time'                                                                                            => 'time',
            'blob', 'binary', 'varbinary'                                                                     => 'binary',
            default                                                                                           => 'mixed',
        };

        $cast = $casts[$dataColumn['name']] ?? null;
        if ($cast) {
            if ($cast == 'hashed' || str_starts_with($cast, 'encrypted')) {
                return null;
            } elseif (str_starts_with($cast, 'decimal')) {
                $phpType = 'number';
            } elseif (
                \in_array($cast, [
                    'array',
                    'json',
                    'collection',
                    'boolean',
                    'immutable_date',
                    'immutable_datetime',
                    'date',
                    'datetime',
                    'timestamp',
                    'time',
                    'year',
                    'integer',
                    'decimal',
                    'float',
                    'double',
                    'real',
                    'string',
                    Json::class,
                    FormStatusCast::class,
                    FormStatusesCast::class,
                ])
            ) {
                $phpType = match ($cast) {
                    Json::class                                             => 'json',
                    FormStatusCast::class                                   => 'formStatus',
                    FormStatusesCast::class                                 => 'formStatuses',
                    'integer', 'decimal', 'float', 'double', 'real', 'year' => 'number',
                    'immutable_date', 'date'                                => 'date',
                    'immutable_datetime', 'datetime', 'timestamp'           => 'datetime',
                    'time'                                                  => 'time',
                    default                                                 => $cast,
                };
            }
        }

        return [
            // "db_type"   => $type,
            'name' => $dataColumn['name'],
            // "length"    => $length,    // alias precision untuk decimal/float
            // "precision" => $precision, // panjang digit total
            // "scale"     => $scale,     // digit setelah koma (0 kalau tidak ada)
            'type'    => $phpType,
            'options' => $options,
        ];
    }

    private static function getColumnConfig(&$columns, $key): array {
        foreach ($columns as $keyCol => $column) {
            if (\is_numeric($keyCol) && $column == $key) {
                unset($columns[$keyCol]);

                return [];
            }
            if (\is_string($keyCol) && $keyCol == $key) {
                if (\is_array($column)) {
                    unset($columns[$key]);
                    if (($column['type'] ?? '') == 'image') {
                        $column['sortable']   = false;
                        $column['searchable'] = false;
                    }

                    return $column;
                }
                unset($columns[$key]);

                return [];
            }
        }

        return [];
    }

    private static function mergeConfigColumns(array ...$configs) {
        $newConfigs = [];
        foreach ($configs as $config) {
            foreach ($config as $key => $value) {
                $newKey   = \is_string($key) ? $key : $value;
                $newValue = is_array($value) ? $value : [];

                $newConfigs[$newKey] = array_merge(($newConfigs[$newKey] ?? []), $newValue);
            }
        }

        return $newConfigs;
    }

    /**
     * Summary of getColumns
     *
     * @param  int  $maxDepth  0 = unlimited
     * @param  array[]  $excepts
     * @return array
     */
    public static function getColumns(int $maxDepth = 0, ...$excepts) {
        $instance      = new static;
        $columns       = Schema::getColumns($instance->getTable());
        $casts         = $instance->getCasts();
        $hidden        = [...$instance->getHidden(), ...$instance->getGuarded()];
        $appends       = $instance->getAppends();
        $configColumns = static::mergeConfigColumns(
            $instance->defaultConfigColumns ?? [],
            $instance->configColumns ?? [],
        );
        $translateKey = $instance->translateKey ?? null;

        $newColumns = [];

        foreach ($columns as $value) {
            if (in_array($value['name'], $hidden)) {
                continue;
            }

            $col    = static::parseColumnType($value, $casts);
            $config = static::getColumnConfig($configColumns, $value['name']);

            if (isset($config['ignore']) && $config['ignore']) {
                continue;
            }
            if ($col) {
                $newColumns[$col['name']] = [
                    'sortable'   => true,
                    'searchable' => true,
                    ...$col,
                    'titleTrans' => $translateKey ? ($translateKey . '.columns.' . $col['name']) : null,
                    ...$config,
                    'primaryKey' => $instance->getKeyName(),
                ];
            }
        }

        foreach ($appends as $value) {
            if (in_array($value, $hidden)) {
                continue;
            }
            $config = static::getColumnConfig($configColumns, $value);

            if (isset($config['ignore']) && $config['ignore']) {
                continue;
            }
            $newColumns[$value] = [
                'name'       => $value,
                'type'       => 'attribute',
                'sortable'   => false,
                'searchable' => false,
                'primaryKey' => $instance->getKeyName(),
                'titleTrans' => $translateKey ? $translateKey . '.columns.' . $value : null,
                ...$config,
            ];
        }

        $isContinueGetRelationColumns = $maxDepth == 0 || $maxDepth > 1;
        if ($maxDepth > 1) {
            $maxDepth--;
        }
        foreach ($configColumns as $key => $relation) {
            $key    = \is_string($key) ? $key : $relation;
            $config = \is_array($relation) ? $relation : [];

            if (! method_exists($instance, $key)) {
                continue;
            }

            $rel = $instance->$key();
            if (! $rel instanceof Relation) {
                continue;
            }

            $classRelation = \get_class($rel->getRelated());
            $type          = 'relations';
            if (\in_array($classRelation, $excepts)) {
                continue;
            }
            if ($rel instanceof MorphTo) {
                $newKey = $rel->getRelationName();
                unset($newColumns[$rel->getForeignKeyName()]);
                unset($newColumns[$rel->getMorphType()]);
                $type = 'relation';
            } elseif ($rel instanceof BelongsTo) {
                unset($newColumns[$rel->getForeignKeyName()]);
                $type   = 'relation';
                $route  = $rel->getRelated()->route;
                $newKey = Str::snake($key);
            } elseif ($rel instanceof HasOne || $rel instanceof MorphOne) {
                $type   = 'relation';
                $route  = $rel->getRelated()->route;
                $newKey = Str::snake($key);
            } elseif ($rel instanceof MorphMany) {
                $type   = 'relations';
                $newKey = Str::snake($key);
            } else {
                $newKey = Str::snake($key);
            }
            if (isset($config['ignore']) && $config['ignore']) {
                continue;
            }
            $newColumns[$newKey] = [
                'name'           => $newKey,
                'type'           => $type,
                'nameOfFunction' => $key,
                'related'        => $classRelation,
                'route'          => isset($route) ? "$route.show" : null,
                'primaryKey'     => $rel->getRelated()->getKeyName(),
                'sortable'       => false,
                'searchable'     => true,
                'titleTrans'     => $translateKey ? "$translateKey.columns.$newKey" : null,
                'columns'        => $isContinueGetRelationColumns ? $classRelation::getColumns($maxDepth, static::class, ...$excepts ?? []) : [],
                ...$config,
            ];
        }

        \usort($newColumns, fn ($a, $b) => $a['name'] <=> $b['name']);

        return $newColumns;
    }
}
