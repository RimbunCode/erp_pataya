<?php

namespace App\Traits;

use App\Casts\FormStatusCast;
use App\Casts\FormStatusesCast;
use App\Casts\Json;
use App\Enums\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Scopes\DataTableScope;
use App\Services\Core\CommandSearchIndexService;
use App\Services\Core\DataTableColumnSelector;
use App\Services\Core\DataTableConfigCache;
use App\Services\Core\HaveTransactionsSyncService;
use App\Utils;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

trait LinkModel {
    protected $defaultConfigColumns = [];

    protected static function bootLinkModel() {
        static::addGlobalScope(new DataTableScope);

        static::saved(function (EloquentModel $model): void {
            app(HaveTransactionsSyncService::class)->syncFromModel($model);
            app(CommandSearchIndexService::class)->syncFromModel($model);
        });

        static::deleted(function (EloquentModel $model): void {
            app(HaveTransactionsSyncService::class)->syncFromModel($model);
            app(CommandSearchIndexService::class)->syncFromModel($model);
        });

        if (\in_array(SoftDeletes::class, \class_uses_recursive(static::class), true)) {
            static::restored(function (EloquentModel $model): void {
                app(HaveTransactionsSyncService::class)->syncFromModel($model);
                app(CommandSearchIndexService::class)->syncFromModel($model);
            });
        }

        static::deleting(function (EloquentModel $model): void {
            if (! config('have_transactions.enforce_delete_guard', true)) {
                return;
            }

            if (($model->canDelete ?? true) === true) {
                return;
            }

            throw ValidationException::withMessages([
                'delete' => 'Data tidak dapat dihapus karena sudah memiliki transaksi atau status tidak mengizinkan.',
            ]);
        });
    }

    public function initializeLinkModel() {
        $this->defaultConfigColumns = array_merge([
            'is_example' => [
                'ignore' => true,
            ],
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
            'submitted_format' => [
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

    public function getAppends() {
        return array_values(array_unique(array_merge(
            $this->appends,
            ['route', 'canDelete', 'keyModel', 'appendStatus', 'thisModel'],
            method_exists(static::class, 'templateLink') ? ['templateLink'] : [],
            method_exists(static::class, 'disabledOn') ? ['disabledOn'] : [],
        )));
    }

    protected function getArrayableAppends() {
        $this->appends = $this->getAppends();

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

    /**
     * Summary of replaceStatus
     *
     * @return array<string, FormStatus|array<FormStatus>|array{
     *     values: array<FormStatus>,
     *     forceReplace?: bool
     * }>
     * */
    protected function replaceStatus() {
        return [];
    }

    protected function getAppendStatusAttribute() {
        $baseStatus = $this->status;
        $baseStatus = $baseStatus instanceof FormStatus ? [$baseStatus] : ($baseStatus ?? []);

        $append     = $this->appendStatus();
        $append     = $append instanceof FormStatus ? [$append] : ($append ?? []);
        $mergeValue = collect($baseStatus)
            ->merge($append)
            ->filter()
            ->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)
            ->unique()
            ->values();

        $flipedValues = $mergeValue->mapWithKeys(fn ($k) => [$k => $k]);
        $result       = [];
        $replaces     = $this->replaceStatus();

        foreach ($replaces as $key => $replace) {
            $forceReplace = false;
            $result       = [];
            if (\is_array($replace)) {
                if (\array_any(\array_keys($replace), fn ($v) => \is_string($v))) {
                    $forceReplace = $replace['forceReplace'] ?? false;
                    $result       = $replace['values'] ?? [];
                } else {
                    $result = [...$result, ...$replace];
                }
            } else {
                $result = $replace;
            }

            if ($flipedValues->get($key)) {
                $flipedValues->put($key, $result);
            } elseif ($forceReplace) {
                $flipedValues->put(Utils::generateRandom(5), $result);
            }
        }

        return $flipedValues
            ->values()
            ->flatten()
            ->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)
            ->unique();

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
        $relation = static::$parentRelation ?? false;
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

    protected static function parseColumnType(array $dataColumn, array $casts) {
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
            'varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set' => 'string',
            'date' => 'date',
            'datetime', 'timestamp' => 'datetime',
            'time' => 'time',
            'blob', 'binary', 'varbinary' => 'binary',
            default => 'mixed',
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
                    Json::class             => 'json',
                    FormStatusCast::class   => 'formStatus',
                    FormStatusesCast::class => 'formStatuses',
                    'integer', 'decimal', 'float', 'double', 'real', 'year' => 'number',
                    'immutable_date', 'date' => 'date',
                    'immutable_datetime', 'datetime', 'timestamp' => 'datetime',
                    'time'  => 'time',
                    default => $cast,
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

    protected static function getColumnConfig(&$columns, $key): array {
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

    protected static function mergeConfigColumns(array ...$configs) {
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
     * Hitung kolom flat 1 model (tanpa rekursi ke relasi anak).
     * Entri relasi disertakan dengan `columns: []`.
     * Selalu dipanggil dengan includeIgnore=true untuk menyimpan superset ke cache.
     *
     * @return array<string, mixed>
     */
    public static function computeColumnsFlat(bool $includeIgnore): array {
        $ignoreFlags = ['ignore' => true, 'hidden' => true, 'searchable' => false, 'show' => false];

        $instance      = new static;
        $columns       = Schema::getColumns($instance->getTable());
        $hasStatusCol  = \in_array('status', \array_column($columns, 'name'), true);
        $casts         = $instance->getCasts();
        $hiddens       = $instance->getHidden();
        $guardeds      = $instance->getGuarded();
        $appends       = $instance->getAppends();
        $configColumns = static::mergeConfigColumns(
            $instance->defaultConfigColumns ?? [],
            $instance->configColumns ?? [],
        );
        $translateKey = $instance->translateKey ?? null;

        $newColumns = [];

        foreach ($columns as $value) {
            $isHidden = \in_array($value['name'], $hiddens, true);
            $isGuard  = \in_array($value['name'], $guardeds, true);

            if ($isHidden) {
                continue;
            }

            $col      = static::parseColumnType($value, $casts);
            $config   = static::getColumnConfig($configColumns, $value['name']);
            $isIgnore = isset($config['ignore']) && $config['ignore'];

            if ($isIgnore && ! $includeIgnore) {
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
                    ...(($isIgnore || $isHidden) ? $ignoreFlags : []),
                    ...($isGuard ? ['ignore' => false] : []),
                ];
            }
        }

        $forcedColumns = \array_filter($configColumns, fn ($col) => $col['forceAppend'] ?? false);
        foreach ($forcedColumns as $key => $config) {
            $isHidden = \in_array($key, $hiddens, true);

            if ($isHidden) {
                continue;
            }
            $key      = \is_string($key) ? $key : $config;
            $config   = \is_array($config) ? $config : [];
            $isIgnore = isset($config['ignore']) && $config['ignore'];

            if ($isIgnore && ! $includeIgnore) {
                continue;
            }
            $newColumns[$key] = [
                'name'       => $key,
                'sortable'   => true,
                'searchable' => true,
                'type'       => 'string',
                'titleTrans' => $translateKey ? ($translateKey . '.columns.' . $key) : null,
                ...$config,
                'primaryKey' => $instance->getKeyName(),
                ...(($isIgnore || $isHidden) ? $ignoreFlags : []),
            ];
        }

        foreach ($appends as $value) {
            $isHidden = \in_array($value, $hiddens, true);

            if ($isHidden) {
                continue;
            }
            $config   = static::getColumnConfig($configColumns, $value);
            $isIgnore = isset($config['ignore']) && $config['ignore'];

            if ($isIgnore && ! $includeIgnore) {
                continue;
            }

            $baselineDepends = [];
            if ($value === 'appendStatus' && $hasStatusCol && ! isset($config['dependsOn'])) {
                $baselineDepends = ['dependsOn' => ['status']];
            } elseif ($value === 'canDelete' && ! isset($config['dependsOn'])) {
                $baselineDepends = ['dependsOn' => (static::$is_submitable ?? false) && $hasStatusCol ? ['status'] : ['have_transactions']];
            } elseif (in_array($value, ['route', 'keyModel', 'thisModel', 'disabledOn'])) {
                // These meta attributes only depend on the ID / primary key, which is already selected
                $baselineDepends = ['dependsOn' => [$instance->getKeyName()]];
            } elseif ($value === 'templateLink') {
                // templateLink requires the columns it formats
                $baselineDepends = ['dependsOn' => method_exists(static::class, 'templateLink')
                    ? DataTableColumnSelector::templateLinkPlaceholders(static::templateLink()) ?: [$instance->getKeyName()]
                    : [$instance->getKeyName()]];
            }

            $newColumns[$value] = [
                'name'       => $value,
                'type'       => 'attribute',
                'sortable'   => false,
                'searchable' => false,
                'primaryKey' => $instance->getKeyName(),
                'titleTrans' => $translateKey ? $translateKey . '.columns.' . $value : null,
                ...$baselineDepends,
                ...$config,
                ...(($isIgnore || $isHidden) ? $ignoreFlags : []),
            ];
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
            $typeRelation  = 'basic';

            if ($rel instanceof MorphTo) {
                $newKey = $rel->getRelationName();
                static::hideOrUnsetForeignKey($newColumns, $rel->getForeignKeyName(), $includeIgnore, $ignoreFlags);
                static::hideOrUnsetForeignKey($newColumns, $rel->getMorphType(), $includeIgnore, $ignoreFlags);
                $type         = 'relation';
                $typeRelation = 'morph';
            } elseif ($rel instanceof BelongsTo) {
                static::hideOrUnsetForeignKey($newColumns, $rel->getForeignKeyName(), $includeIgnore, $ignoreFlags);
                $type   = 'relation';
                $route  = $rel->getRelated()->route;
                $newKey = Str::snake($key);
            } elseif ($rel instanceof HasOne || $rel instanceof MorphOne) {
                $type   = 'relation';
                $route  = $rel->getRelated()->route;
                $newKey = Str::snake($key);
            } elseif ($rel instanceof MorphMany) {
                $type         = 'relations';
                $newKey       = Str::snake($key);
                $typeRelation = 'morph';
            } else {
                $newKey = Str::snake($key);
            }

            $isIgnore = isset($config['ignore']) && $config['ignore'];
            if ($isIgnore && ! $includeIgnore) {
                continue;
            }

            $newColumns[$newKey] = [
                'name'           => $newKey,
                'type'           => $type,
                'typeRelation'   => $typeRelation,
                'nameOfFunction' => $key,
                'related'        => $classRelation,
                'route'          => isset($route) ? "$route.show" : null,
                'primaryKey'     => $rel->getRelated()->getKeyName(),
                'sortable'       => false,
                'searchable'     => true,
                'titleTrans'     => $translateKey ? "$translateKey.columns.$newKey" : null,
                'columns'        => [],
                ...$config,
                ...($isIgnore ? $ignoreFlags : []),
            ];

            unset($route);
        }

        \usort($newColumns, fn ($a, $b) => $a['name'] <=> $b['name']);

        return $newColumns;
    }

    /**
     * Summary of getColumns
     *
     * @param  int  $maxDepth  0 = unlimited
     * @param  bool  $includeIgnore  true = sertakan FK + kolom `ignore` (ditandai
     *                               flag hidden/ignore/searchable:false/show:false)
     *                               agar FilterColumnResolver mengenalinya sebagai
     *                               bagian schema. UI tetap meng-gate flag tsb.
     *                               Default false = perilaku lama (FK ter-unset,
     *                               ignore ter-skip).
     * @param  array[]  $excepts
     */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        try {
            $flat = DataTableConfigCache::flat(static::class);
        } catch (\Throwable) {
            $flat = static::computeColumnsFlat(true);
        }

        if (! $includeIgnore) {
            $flat = \array_values(\array_filter($flat, fn ($col) => ! ($col['ignore'] ?? false)));
        }

        return static::assembleNested($flat, $maxDepth, $includeIgnore, static::class, ...$excepts);
    }

    /**
     * Rakit struktur nested dari flat cache sesuai maxDepth dan excepts.
     *
     * @param  array<string, mixed>  $flat
     * @param  string[]  $excepts
     * @return array<string, mixed>
     */
    private static function assembleNested(array $flat, int $maxDepth, bool $includeIgnore, string $selfClass, ...$excepts): array {
        $isContinueGetRelationColumns = $maxDepth == 0 || $maxDepth > 1;
        $childDepth                   = $maxDepth > 1 ? $maxDepth - 1 : $maxDepth;

        $result = [];

        foreach ($flat as $col) {
            $isRelation = isset($col['nameOfFunction']);

            if (! $isRelation) {
                $result[$col['name']] = $col;

                continue;
            }

            $classRelation = $col['related'] ?? null;

            if ($classRelation && \in_array($classRelation, $excepts, true)) {
                continue;
            }

            $childColumns = [];
            if ($isContinueGetRelationColumns && $classRelation && \method_exists($classRelation, 'getColumns')) {
                $childColumns = $classRelation::getColumns($childDepth, $includeIgnore, $selfClass, ...$excepts);
            }

            $result[$col['name']] = [
                ...$col,
                'columns' => $childColumns,
            ];
        }

        return \array_values($result);
    }

    /**
     * Sembunyikan atau buang kolom FK relasi dari daftar getColumns.
     * - default (includeIgnore=false): unset kolom (perilaku lama — bersih utk UI).
     * - includeIgnore=true: pertahankan entri tapi tandai flag hidden agar
     *   FilterColumnResolver dapat me-resolve FK; UI tetap meng-gate flag hidden.
     *
     * @param  array<string,array<string,mixed>>  $newColumns
     * @param  array<string,mixed>  $ignoreFlags
     */
    private static function hideOrUnsetForeignKey(array &$newColumns, string $fkName, bool $includeIgnore, array $ignoreFlags): void {
        if (! isset($newColumns[$fkName])) {
            return;
        }
        if ($includeIgnore) {
            $newColumns[$fkName] = [...$newColumns[$fkName], ...$ignoreFlags];
        } else {
            unset($newColumns[$fkName]);
        }
    }
}
