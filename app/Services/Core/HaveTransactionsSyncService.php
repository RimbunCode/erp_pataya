<?php

namespace App\Services\Core;

use App\Jobs\Core\ReplayHaveTransactionsSyncJob;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class HaveTransactionsSyncService {
    protected array $columnsCache             = [];
    protected array $foreignKeysCache         = [];
    protected array $hasColumnCache           = [];
    protected array $trackedTablesCache       = [];
    protected array $modelTableMap            = [];
    protected array $tableSubmitableMap       = [];
    protected array $belongsToDescriptorCache = [];
    protected array $morphDescriptorCache     = [];
    protected ?array $excludedSourceTables    = null;
    protected ?array $excludedTargetTables    = null;
    protected ?array $excludedMorphRelations  = null;
    protected ?array $excludedStatuses        = null;

    public function syncFromModel(EloquentModel $model): void {
        if (! config('have_transactions.enabled', true)) {
            return;
        }

        $startedAt  = microtime(true);
        $childTable = $this->normalizeTableName($model->getTable());
        if ($this->isExcludedSourceTable($childTable)) {
            return;
        }

        $trackedTables = $this->resolveTrackedTables();
        if ($trackedTables === []) {
            return;
        }

        $references = [
            ...$this->extractBelongsToReferencesFromModel($model, $trackedTables),
            ...$this->extractMorphReferencesFromModel($model, $trackedTables),
        ];

        $affectedRows = $this->markReferences($references, $trackedTables);

        if ($this->shouldDispatchAsyncReplay() && $references !== []) {
            try {
                ReplayHaveTransactionsSyncJob::dispatch($references, $trackedTables)->afterCommit();
            } catch (\Throwable $exception) {
                if (config('have_transactions.runtime_debug_log', false)) {
                    Log::warning('have_transactions.async_replay_dispatch_failed', [
                        'model'   => $model::class,
                        'table'   => $childTable,
                        'message' => $exception->getMessage(),
                    ]);
                }
            }
        }

        $this->logRuntimeSync(
            model: $model,
            childTable: $childTable,
            referenceCount: count($references),
            affectedRows: $affectedRows,
            startedAt: $startedAt,
        );
    }

    /**
     * @param  array<int, array{table: string, column: string, value: mixed}>  $references
     * @param  string[]|null  $trackedTables
     */
    public function replayReferences(array $references, ?array $trackedTables = null): int {
        if (! config('have_transactions.enabled', true)) {
            return 0;
        }

        $trackedTables ??= $this->resolveTrackedTables();
        if ($trackedTables === []) {
            return 0;
        }

        return $this->markReferences($references, $trackedTables);
    }

    /**
     * @return array{
     *     dry_run: bool,
     *     chunk: int,
     *     target_tables: string[],
     *     scanned_tables: int,
     *     reset_counts: array<string, int>,
     *     marked_counts: array<string, int>,
     *     references_detected: int
     * }
     */
    public function recalculate(?string $only = null, bool $dryRun = false, int $chunk = 1000): array {
        $chunk = max(1, $chunk);

        $trackedTables = $this->resolveTrackedTables();
        $targetTables  = $trackedTables;

        if ($only !== null && $only !== '') {
            $resolved = $this->resolveTableFromModelOrTableInput($only);
            if (! $resolved || ! in_array($resolved, $trackedTables, true)) {
                throw new \InvalidArgumentException("Target '{$only}' tidak termasuk tracked table have_transactions.");
            }

            $targetTables = [$resolved];
        }

        $resetCounts = [];
        foreach ($targetTables as $table) {
            if ($dryRun) {
                $resetCounts[$table] = (int) DB::table($table)->count();

                continue;
            }

            $resetCounts[$table] = DB::table($table)->update([
                'have_transactions' => false,
            ]);
        }

        $scanTables         = $this->resolveScannableChildTables();
        $markedCounts       = array_fill_keys($targetTables, 0);
        $referencesDetected = 0;

        foreach ($scanTables as $childTable) {
            $this->scanBelongsToReferences(
                $childTable,
                $targetTables,
                $dryRun,
                $chunk,
                $markedCounts,
                $referencesDetected,
            );
            $this->scanMorphReferences(
                $childTable,
                $targetTables,
                $dryRun,
                $chunk,
                $markedCounts,
                $referencesDetected,
            );
        }

        return [
            'dry_run'             => $dryRun,
            'chunk'               => $chunk,
            'target_tables'       => $targetTables,
            'scanned_tables'      => count($scanTables),
            'reset_counts'        => $resetCounts,
            'marked_counts'       => $markedCounts,
            'references_detected' => $referencesDetected,
        ];
    }

    /**
     * @param  array<int, array{table: string, column: string, value: mixed}>  $references
     */
    protected function markReferences(array $references, array $trackedTables): int {
        $grouped = [];

        foreach ($references as $reference) {
            $table  = $this->normalizeTableName($reference['table']);
            $column = $reference['column'];
            $value  = $reference['value'];

            if ($value === null || $value === '') {
                continue;
            }

            if (! $this->isTrackedTargetTable($table, $trackedTables)) {
                continue;
            }

            $grouped[$table][$column][] = (string) $value;
        }

        $affectedRows = 0;

        foreach ($grouped as $table => $columns) {
            foreach ($columns as $column => $values) {
                $values = array_values(array_unique($values));

                if ($values === []) {
                    continue;
                }

                $affectedRows += DB::table($table)
                    ->whereIn($column, $values)
                    ->where('have_transactions', false)
                    ->update([
                        'have_transactions' => true,
                    ]);
            }
        }

        return $affectedRows;
    }

    /**
     * @param  string[]  $trackedTables
     * @return array<int, array{table: string, column: string, value: mixed}>
     */
    protected function extractBelongsToReferencesFromModel(EloquentModel $model, array $trackedTables): array {
        $references = [];
        $childTable = $this->normalizeTableName($model->getTable());

        foreach ($this->getBelongsToDescriptors($childTable, $trackedTables) as $descriptor) {
            $value = $model->getAttribute($descriptor['child_column']);
            if ($value === null || $value === '') {
                continue;
            }

            $references[] = [
                'table'  => $descriptor['parent_table'],
                'column' => $descriptor['parent_column'],
                'value'  => $value,
            ];
        }

        return $references;
    }

    /**
     * @param  string[]  $trackedTables
     * @return array<int, array{table: string, column: string, value: mixed}>
     */
    protected function extractMorphReferencesFromModel(EloquentModel $model, array $trackedTables): array {
        $references = [];
        $childTable = $this->normalizeTableName($model->getTable());

        foreach ($this->getMorphDescriptors($childTable) as $pair) {
            $type = $model->getAttribute($pair['type_column']);
            $id   = $model->getAttribute($pair['id_column']);

            if (! is_string($type) || $type === '' || $id === null || $id === '') {
                continue;
            }

            $parentTable = $this->resolveTableFromModelClass($type);
            if (! $parentTable) {
                continue;
            }

            if (! $this->isTrackedTargetTable($parentTable, $trackedTables)) {
                continue;
            }

            $references[] = [
                'table'  => $parentTable,
                'column' => 'id',
                'value'  => $id,
            ];
        }

        return $references;
    }

    /**
     * @param  array<string, int>  $markedCounts
     */
    protected function scanBelongsToReferences(
        string $childTable,
        array $targetTables,
        bool $dryRun,
        int $chunk,
        array &$markedCounts,
        int &$referencesDetected,
    ): void {
        foreach ($this->getForeignKeys($childTable) as $foreignKey) {
            $childColumns  = (array) ($foreignKey['columns'] ?? []);
            $parentColumns = (array) ($foreignKey['foreign_columns'] ?? []);

            if (count($childColumns) !== 1 || count($parentColumns) !== 1) {
                continue;
            }

            $childColumn = $childColumns[0] ?? null;
            $parentTable = $this->normalizeTableName((string) ($foreignKey['foreign_table'] ?? ''));
            $parentCol   = $parentColumns[0] ?? null;

            if (! $childColumn || ! $parentTable || ! $parentCol) {
                continue;
            }

            if (! $this->isTrackedTargetTable($parentTable, $targetTables)) {
                continue;
            }

            $query = DB::table($childTable)
                ->select([$childColumn])
                ->whereNotNull($childColumn);

            if ($this->hasColumn($childTable, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $needsStatusFilter = $this->isSubmitableTable($childTable) && $this->hasColumn($childTable, 'status');
            if ($needsStatusFilter) {
                $query->addSelect('status');
            }

            $query->orderBy($this->resolveOrderColumn($childTable, $childColumn))
                ->chunk($chunk, function ($rows) use (
                    $childColumn,
                    $parentTable,
                    $parentCol,
                    $needsStatusFilter,
                    $dryRun,
                    &$markedCounts,
                    &$referencesDetected
                ) {
                    $ids = [];

                    foreach ($rows as $row) {
                        $status = $needsStatusFilter ? ($row->status ?? null) : null;
                        if (! $this->isActiveByStatus($status, $needsStatusFilter)) {
                            continue;
                        }

                        $value = $row->{$childColumn} ?? null;
                        if ($value === null || $value === '') {
                            continue;
                        }

                        $ids[] = (string) $value;
                    }

                    $ids = array_values(array_unique($ids));
                    if ($ids === []) {
                        return;
                    }

                    $referencesDetected += count($ids);
                    if ($dryRun) {
                        $markedCounts[$parentTable] += count($ids);

                        return;
                    }

                    $markedCounts[$parentTable] += DB::table($parentTable)
                        ->whereIn($parentCol, $ids)
                        ->where('have_transactions', false)
                        ->update([
                            'have_transactions' => true,
                        ]);
                });
        }
    }

    /**
     * @param  array<string, int>  $markedCounts
     */
    protected function scanMorphReferences(
        string $childTable,
        array $targetTables,
        bool $dryRun,
        int $chunk,
        array &$markedCounts,
        int &$referencesDetected,
    ): void {
        foreach ($this->getMorphPairs($childTable) as $pair) {
            if ($this->isExcludedMorphRelation($pair['name'])) {
                continue;
            }

            $query = DB::table($childTable)
                ->select([$pair['type_column'], $pair['id_column']])
                ->whereNotNull($pair['type_column'])
                ->whereNotNull($pair['id_column']);

            if ($this->hasColumn($childTable, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $needsStatusFilter = $this->isSubmitableTable($childTable) && $this->hasColumn($childTable, 'status');
            if ($needsStatusFilter) {
                $query->addSelect('status');
            }

            $query->orderBy($this->resolveOrderColumn($childTable, $pair['type_column']))
                ->chunk($chunk, function ($rows) use (
                    $pair,
                    $targetTables,
                    $needsStatusFilter,
                    $dryRun,
                    &$markedCounts,
                    &$referencesDetected
                ) {
                    $grouped = [];

                    foreach ($rows as $row) {
                        $status = $needsStatusFilter ? ($row->status ?? null) : null;
                        if (! $this->isActiveByStatus($status, $needsStatusFilter)) {
                            continue;
                        }

                        $type = $row->{$pair['type_column']} ?? null;
                        $id   = $row->{$pair['id_column']} ?? null;
                        if (! is_string($type) || $type === '' || $id === null || $id === '') {
                            continue;
                        }

                        $parentTable = $this->resolveTableFromModelClass($type);
                        if (! $parentTable) {
                            continue;
                        }
                        if (! $this->isTrackedTargetTable($parentTable, $targetTables)) {
                            continue;
                        }

                        $grouped[$parentTable][] = (string) $id;
                    }

                    foreach ($grouped as $table => $ids) {
                        $ids = array_values(array_unique($ids));
                        if ($ids === []) {
                            continue;
                        }

                        $referencesDetected += count($ids);
                        if ($dryRun) {
                            $markedCounts[$table] += count($ids);

                            continue;
                        }

                        $markedCounts[$table] += DB::table($table)
                            ->whereIn('id', $ids)
                            ->where('have_transactions', false)
                            ->update([
                                'have_transactions' => true,
                            ]);
                    }
                });
        }
    }

    protected function resolveOrderColumn(string $table, string $fallback): string {
        if ($this->hasColumn($table, 'id')) {
            return 'id';
        }

        return $fallback;
    }

    protected function resolveTrackedTables(): array {
        $connectionKey = (string) DB::getDefaultConnection();
        $databaseName  = (string) DB::getDatabaseName();
        $configured    = (array) config('have_transactions.tracked_tables', []);
        $signature     = md5(json_encode([
            'connection' => $connectionKey,
            'database'   => $databaseName,
            'configured' => $configured,
        ]));

        if (array_key_exists($signature, $this->trackedTablesCache)) {
            return $this->trackedTablesCache[$signature];
        }

        $tables = $this->rememberMetadata("tracked_tables:{$signature}", function () use ($configured) {
            $resolved = $configured;
            if ($resolved === []) {
                $resolved = array_filter(
                    $this->resolveScannableChildTables(),
                    fn ($table) => $this->hasColumn($table, 'have_transactions'),
                );
            }

            $tables = [];
            foreach ($resolved as $table) {
                $table = $this->normalizeTableName((string) $table);
                if ($table === '' || ! Schema::hasTable($table) || ! $this->hasColumn($table, 'have_transactions')) {
                    continue;
                }
                $tables[] = $table;
            }

            return array_values(array_unique($tables));
        });

        $this->trackedTablesCache[$signature] = is_array($tables)
            ? array_values(array_unique(array_map(fn ($table) => $this->normalizeTableName((string) $table), $tables)))
            : [];

        return $this->trackedTablesCache[$signature];
    }

    protected function resolveScannableChildTables(): array {
        $database = DB::getDatabaseName();
        $tables   = [];

        try {
            $tables = Schema::getTableListing(schema: $database, schemaQualified: false);
        } catch (\Throwable) {
            $tables = Schema::getTableListing();
        }

        if ($tables === []) {
            $tables = Schema::getTableListing();
        }

        $normalized = array_values(array_unique(array_map(
            fn ($table) => $this->normalizeTableName((string) $table),
            $tables,
        )));

        return array_values(array_filter(
            $normalized,
            fn ($table) => $table !== '' && Schema::hasTable($table) && ! $this->isExcludedSourceTable($table),
        ));
    }

    protected function isTrackedTargetTable(string $table, array $trackedTables): bool {
        if (! in_array($table, $trackedTables, true)) {
            return false;
        }

        return ! $this->isExcludedTargetTable($table);
    }

    protected function isExcludedSourceTable(string $table): bool {
        return in_array($table, $this->getExcludedSourceTables(), true);
    }

    protected function isExcludedTargetTable(string $table): bool {
        return in_array($table, $this->getExcludedTargetTables(), true);
    }

    protected function isExcludedMorphRelation(string $relationName): bool {
        return in_array($relationName, $this->getExcludedMorphRelations(), true);
    }

    /**
     * @return array<int, array{name: string, type_column: string, id_column: string}>
     */
    protected function getMorphPairs(string $table): array {
        $names  = $this->getColumns($table);
        $lookup = array_flip($names);
        $pairs  = [];

        foreach ($names as $name) {
            if (! str_ends_with($name, '_type')) {
                continue;
            }

            $prefix   = substr($name, 0, -5);
            $idColumn = "{$prefix}_id";
            if (! array_key_exists($idColumn, $lookup)) {
                continue;
            }

            $pairs[] = [
                'name'        => $prefix,
                'type_column' => $name,
                'id_column'   => $idColumn,
            ];
        }

        return $pairs;
    }

    protected function getColumns(string $table): array {
        if (! array_key_exists($table, $this->columnsCache)) {
            $columns = $this->rememberMetadata("columns:{$table}", function () use ($table) {
                return array_map(
                    fn ($column) => $column['name'],
                    Schema::getColumns($table),
                );
            });
            $this->columnsCache[$table] = is_array($columns) ? $columns : [];
        }

        return $this->columnsCache[$table];
    }

    protected function getForeignKeys(string $table): array {
        if (! array_key_exists($table, $this->foreignKeysCache)) {
            $foreignKeys = $this->rememberMetadata("foreign_keys:{$table}", function () use ($table) {
                try {
                    return Schema::getForeignKeys($table);
                } catch (\Throwable) {
                    return [];
                }
            });

            $this->foreignKeysCache[$table] = is_array($foreignKeys) ? $foreignKeys : [];
        }

        return $this->foreignKeysCache[$table];
    }

    protected function hasColumn(string $table, string $column): bool {
        $cacheKey = "{$table}:{$column}";
        if (! array_key_exists($cacheKey, $this->hasColumnCache)) {
            $hasColumn = $this->rememberMetadata("has_column:{$cacheKey}", function () use ($table, $column) {
                return Schema::hasColumn($table, $column);
            });
            $this->hasColumnCache[$cacheKey] = (bool) $hasColumn;
        }

        return $this->hasColumnCache[$cacheKey];
    }

    protected function normalizeTableName(string $table): string {
        if ($table === '') {
            return $table;
        }

        if (str_contains($table, '.')) {
            return (string) str($table)->afterLast('.');
        }

        return $table;
    }

    protected function resolveTableFromModelOrTableInput(string $value): ?string {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $tableFromClass = $this->resolveTableFromModelClass($value);
        if ($tableFromClass) {
            return $tableFromClass;
        }

        $table = $this->normalizeTableName($value);
        if (! Schema::hasTable($table)) {
            return null;
        }

        return $table;
    }

    protected function resolveTableFromModelClass(string $className): ?string {
        $this->primeModelMaps();

        if (isset($this->modelTableMap[$className])) {
            return $this->modelTableMap[$className];
        }

        if (! class_exists($className) || ! is_subclass_of($className, EloquentModel::class)) {
            return null;
        }

        try {
            /** @var EloquentModel $instance */
            $instance = new $className;
            $table    = $this->normalizeTableName($instance->getTable());

            $this->modelTableMap[$className]  = $table;
            $this->tableSubmitableMap[$table] = method_exists($instance, 'isSubmitable')
                ? (bool) $instance->isSubmitable()
                : false;

            return $table;
        } catch (\Throwable) {
            return null;
        }
    }

    protected function primeModelMaps(): void {
        if ($this->modelTableMap !== []) {
            return;
        }

        $maps = $this->rememberMetadata('model_maps:v1', function () {
            $modelPath = app_path('Models');
            if (! is_dir($modelPath)) {
                return [
                    'model_table_map'      => [],
                    'table_submitable_map' => [],
                ];
            }

            $modelTableMap      = [];
            $tableSubmitableMap = [];

            foreach (File::allFiles($modelPath) as $file) {
                $relative = str_replace([$modelPath . DIRECTORY_SEPARATOR, '.php'], '', $file->getPathname());
                $class    = 'App\\Models\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relative);

                if (! class_exists($class) || ! is_subclass_of($class, EloquentModel::class)) {
                    continue;
                }

                try {
                    /** @var EloquentModel $instance */
                    $instance = new $class;
                    $table    = $this->normalizeTableName($instance->getTable());

                    $modelTableMap[$class]      = $table;
                    $tableSubmitableMap[$table] = method_exists($instance, 'isSubmitable')
                        ? (bool) $instance->isSubmitable()
                        : false;
                } catch (\Throwable) {
                    continue;
                }
            }

            return [
                'model_table_map'      => $modelTableMap,
                'table_submitable_map' => $tableSubmitableMap,
            ];
        });

        if (! is_array($maps)) {
            $maps = [];
        }

        $this->modelTableMap      = is_array($maps['model_table_map'] ?? null) ? $maps['model_table_map'] : [];
        $this->tableSubmitableMap = is_array($maps['table_submitable_map'] ?? null) ? $maps['table_submitable_map'] : [];
    }

    protected function isSubmitableTable(string $table): bool {
        $this->primeModelMaps();

        if (array_key_exists($table, $this->tableSubmitableMap)) {
            return (bool) $this->tableSubmitableMap[$table];
        }

        $isSubmitable = false;
        if (
            $this->hasColumn($table, 'status')
            && ($this->hasColumn($table, 'submitted_at') || $this->hasColumn($table, 'created_by_id'))
        ) {
            $isSubmitable = true;
        }

        $this->tableSubmitableMap[$table] = $isSubmitable;

        return $isSubmitable;
    }

    protected function isActiveByStatus(mixed $status, bool $needsStatusFilter): bool {
        if (! $needsStatusFilter) {
            return true;
        }

        $excluded = $this->getExcludedSubmitableStatuses();

        if ($excluded === []) {
            return true;
        }

        $statuses = $this->normalizeStatuses($status);
        if ($statuses === []) {
            return true;
        }

        return count(array_intersect($statuses, $excluded)) === 0;
    }

    /**
     * @return string[]
     */
    protected function normalizeStatuses(mixed $status): array {
        if ($status === null || $status === '') {
            return [];
        }

        if (is_string($status)) {
            $decoded = json_decode($status, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $status = $decoded;
            }
        }

        if (is_string($status)) {
            return [strtolower($status)];
        }

        if (! is_array($status)) {
            return [];
        }

        $result = [];
        foreach ($status as $value) {
            if (is_string($value) && $value !== '') {
                $result[] = strtolower($value);
            }
        }

        return array_values(array_unique($result));
    }

    /**
     * @param  string[]  $trackedTables
     * @return array<int, array{child_column: string, parent_table: string, parent_column: string}>
     */
    protected function getBelongsToDescriptors(string $childTable, array $trackedTables): array {
        $tracked = array_values(array_unique($trackedTables));
        sort($tracked);
        $cacheKey = $childTable . ':' . md5(json_encode($tracked));

        if (array_key_exists($cacheKey, $this->belongsToDescriptorCache)) {
            return $this->belongsToDescriptorCache[$cacheKey];
        }

        $descriptors = [];

        foreach ($this->getForeignKeys($childTable) as $foreignKey) {
            $childColumns  = (array) ($foreignKey['columns'] ?? []);
            $parentColumns = (array) ($foreignKey['foreign_columns'] ?? []);

            if (count($childColumns) !== 1 || count($parentColumns) !== 1) {
                continue;
            }

            $childColumn = $childColumns[0] ?? null;
            $parentTable = $this->normalizeTableName((string) ($foreignKey['foreign_table'] ?? ''));
            $parentCol   = $parentColumns[0] ?? null;

            if (! $childColumn || ! $parentTable || ! $parentCol) {
                continue;
            }

            if (! $this->isTrackedTargetTable($parentTable, $trackedTables)) {
                continue;
            }

            $descriptors[] = [
                'child_column'  => $childColumn,
                'parent_table'  => $parentTable,
                'parent_column' => $parentCol,
            ];
        }

        $this->belongsToDescriptorCache[$cacheKey] = $descriptors;

        return $descriptors;
    }

    /**
     * @return array<int, array{name: string, type_column: string, id_column: string}>
     */
    protected function getMorphDescriptors(string $childTable): array {
        $excluded = $this->getExcludedMorphRelations();
        sort($excluded);
        $cacheKey = $childTable . ':' . md5(json_encode($excluded));

        if (array_key_exists($cacheKey, $this->morphDescriptorCache)) {
            return $this->morphDescriptorCache[$cacheKey];
        }

        $pairs = array_values(array_filter(
            $this->getMorphPairs($childTable),
            fn ($pair) => ! $this->isExcludedMorphRelation($pair['name']),
        ));

        $this->morphDescriptorCache[$cacheKey] = $pairs;

        return $pairs;
    }

    /**
     * @return string[]
     */
    protected function getExcludedSourceTables(): array {
        if ($this->excludedSourceTables !== null) {
            return $this->excludedSourceTables;
        }

        $this->excludedSourceTables = array_values(array_unique(array_map(
            fn ($value) => $this->normalizeTableName((string) $value),
            (array) config('have_transactions.excluded_source_tables', []),
        )));

        return $this->excludedSourceTables;
    }

    /**
     * @return string[]
     */
    protected function getExcludedTargetTables(): array {
        if ($this->excludedTargetTables !== null) {
            return $this->excludedTargetTables;
        }

        $this->excludedTargetTables = array_values(array_unique(array_map(
            fn ($value) => $this->normalizeTableName((string) $value),
            (array) config('have_transactions.excluded_target_tables', []),
        )));

        return $this->excludedTargetTables;
    }

    /**
     * @return string[]
     */
    protected function getExcludedMorphRelations(): array {
        if ($this->excludedMorphRelations !== null) {
            return $this->excludedMorphRelations;
        }

        $this->excludedMorphRelations = array_values(array_unique(array_map(
            fn ($value) => (string) $value,
            (array) config('have_transactions.excluded_morph_relations', []),
        )));

        return $this->excludedMorphRelations;
    }

    /**
     * @return string[]
     */
    protected function getExcludedSubmitableStatuses(): array {
        if ($this->excludedStatuses !== null) {
            return $this->excludedStatuses;
        }

        $this->excludedStatuses = array_values(array_unique(array_map(
            fn ($value) => strtolower((string) $value),
            (array) config('have_transactions.excluded_submitable_statuses', ['canceled', 'rejected']),
        )));

        return $this->excludedStatuses;
    }

    protected function shouldDispatchAsyncReplay(): bool {
        if (! config('have_transactions.async_replay_enabled', false)) {
            return false;
        }

        return strtolower((string) config('have_transactions.runtime_mode', 'sync')) === 'hybrid';
    }

    protected function isMetadataCacheEnabled(): bool {
        return (bool) config('have_transactions.metadata_cache_enabled', true);
    }

    protected function metadataCacheTtlSeconds(): int {
        $ttl = (int) config('have_transactions.metadata_cache_ttl_seconds', 600);

        return max(1, $ttl);
    }

    protected function metadataCacheKey(string $suffix): string {
        $prefix     = trim((string) config('have_transactions.metadata_cache_prefix', 'have_transactions'));
        $connection = (string) DB::getDefaultConnection();
        $database   = (string) DB::getDatabaseName();

        return "{$prefix}:{$connection}:{$database}:{$suffix}";
    }

    protected function rememberMetadata(string $suffix, callable $resolver): mixed {
        if (! $this->isMetadataCacheEnabled()) {
            return $resolver();
        }

        $key = $this->metadataCacheKey($suffix);
        $ttl = now()->addSeconds($this->metadataCacheTtlSeconds());

        try {
            return Cache::remember($key, $ttl, $resolver);
        } catch (\Throwable) {
            return $resolver();
        }
    }

    protected function logRuntimeSync(
        EloquentModel $model,
        string $childTable,
        int $referenceCount,
        int $affectedRows,
        float $startedAt,
    ): void {
        if (! config('have_transactions.runtime_debug_log', false)) {
            return;
        }

        Log::debug('have_transactions.runtime_sync', [
            'model'           => $model::class,
            'table'           => $childTable,
            'reference_count' => $referenceCount,
            'affected_rows'   => $affectedRows,
            'duration_ms'     => round((microtime(true) - $startedAt) * 1000, 2),
            'runtime_mode'    => (string) config('have_transactions.runtime_mode', 'sync'),
        ]);
    }
}
