<?php

namespace App\Services\Migration;

use App\FormStatus;
use App\Models\Core\Log as ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

abstract class BaseMigrator {
    protected string $sourceConnection = 'legacy';

    /**
     * @var array<string, string|null>
     */
    protected array $idMapping = [];

    protected ?string $fallbackCreatedById = null;
    protected ?string $fallbackUnitId      = null;
    protected ?string $fallbackBranchId    = null;
    protected int $chunkSize               = 500;

    /**
     * @var array<string, string|null>
     */
    protected array $permissionIdCache = [];

    /**
     * Map old ID to new ULID.
     */
    protected function mapId(string $sourceTable, mixed $oldId, string $newUlid): void {
        $normalizedOldId = (string) $oldId;

        DB::table('migration_mappings')->updateOrInsert(
            ['table_name' => $sourceTable, 'old_id' => $normalizedOldId],
            ['new_ulid' => $newUlid, 'updated_at' => now(), 'created_at' => now()],
        );

        $this->idMapping[$this->mappingCacheKey($sourceTable, $normalizedOldId)] = $newUlid;
    }

    /**
     * Get new ULID from old ID.
     */
    protected function getNewId(string $sourceTable, mixed $oldId): ?string {
        if ($oldId === null || $oldId === '') {
            return null;
        }

        $normalizedOldId = (string) $oldId;
        $cacheKey        = $this->mappingCacheKey($sourceTable, $normalizedOldId);

        if (array_key_exists($cacheKey, $this->idMapping)) {
            return $this->idMapping[$cacheKey];
        }

        $newUlid = DB::table('migration_mappings')
            ->where('table_name', $sourceTable)
            ->where('old_id', $normalizedOldId)
            ->value('new_ulid');

        $this->idMapping[$cacheKey] = $newUlid ? (string) $newUlid : null;

        return $this->idMapping[$cacheKey];
    }

    protected function mappingCacheKey(string $sourceTable, string $oldId): string {
        return $sourceTable . '|' . $oldId;
    }

    protected function checkpointNamespace(): string {
        return static::class;
    }

    protected function checkpointScope(string $checkpointKey): array {
        return [
            'migrator'       => $this->checkpointNamespace(),
            'checkpoint_key' => $checkpointKey,
        ];
    }

    protected function getCheckpoint(string $checkpointKey): ?string {
        $value = DB::table('migration_checkpoints')
            ->where($this->checkpointScope($checkpointKey))
            ->value('last_processed_key');

        return $value !== null ? (string) $value : null;
    }

    protected function saveCheckpoint(string $checkpointKey, string $lastProcessedKey): void {
        DB::table('migration_checkpoints')->updateOrInsert(
            $this->checkpointScope($checkpointKey),
            [
                'last_processed_key' => $lastProcessedKey,
                'created_at'         => now(),
                'updated_at'         => now(),
            ],
        );
    }

    protected function clearCheckpoint(string $checkpointKey): void {
        DB::table('migration_checkpoints')
            ->where($this->checkpointScope($checkpointKey))
            ->delete();
    }

    /**
     * @param  callable(object): void  $handleRecord
     */
    protected function processChunkedWithCheckpoint(
        QueryBuilder $query,
        string $checkpointKey,
        string $orderColumn,
        callable $handleRecord,
        ?string $recordKeyAttribute = null,
        ?int $chunkSize = null,
    ): void {
        $recordKeyAttribute ??= str_contains($orderColumn, '.')
            ? (string) str($orderColumn)->afterLast('.')
            : $orderColumn;
        $lastProcessed = $this->getCheckpoint($checkpointKey);

        if ($lastProcessed !== null && $lastProcessed !== '') {
            $query->where($orderColumn, '>', $lastProcessed);
            $this->log("Melanjutkan {$checkpointKey} dari key > {$lastProcessed}");
        }

        $query
            ->orderBy($orderColumn)
            ->chunk($chunkSize ?? $this->chunkSize, function ($records) use ($checkpointKey, $recordKeyAttribute, $handleRecord): void {
                foreach ($records as $record) {
                    $recordKey = data_get($record, $recordKeyAttribute);
                    if ($recordKey === null || $recordKey === '') {
                        throw new RuntimeException("Key checkpoint {$recordKeyAttribute} tidak ditemukan pada proses {$checkpointKey}.");
                    }

                    $handleRecord($record);
                    $this->saveCheckpoint($checkpointKey, (string) $recordKey);
                }
            });

        $this->clearCheckpoint($checkpointKey);
    }

    protected function resolveCreatedById(mixed $legacyUserId = null): string {
        if ($legacyUserId !== null && $legacyUserId !== '') {
            $mappedUserId = $this->getNewId('users', $legacyUserId);
            if ($mappedUserId !== null) {
                return $mappedUserId;
            }
        }

        if ($this->fallbackCreatedById !== null) {
            return $this->fallbackCreatedById;
        }

        $configuredUserId = env('LEGACY_MIGRATION_USER_ID');
        if (is_string($configuredUserId) && $configuredUserId !== '') {
            $existingUserId = DB::table('users')
                ->where('id', $configuredUserId)
                ->value('id');

            if ($existingUserId !== null) {
                $this->fallbackCreatedById = (string) $existingUserId;

                return $this->fallbackCreatedById;
            }
        }

        $fallbackUserId = DB::table('users')
            ->orderBy('created_at')
            ->value('id');

        if ($fallbackUserId === null) {
            throw new RuntimeException('Tidak ada user ERP yang bisa dijadikan created_by_id untuk migrasi legacy.');
        }

        $this->fallbackCreatedById = (string) $fallbackUserId;

        return $this->fallbackCreatedById;
    }

    protected function resolveDefaultUnitId(?string $itemVariantId = null): ?string {
        if ($itemVariantId !== null) {
            $itemDefaultUnitId = DB::table('item_variants')
                ->where('id', $itemVariantId)
                ->value('default_unit_id');

            if ($itemDefaultUnitId !== null) {
                return (string) $itemDefaultUnitId;
            }
        }

        if ($this->fallbackUnitId !== null) {
            return $this->fallbackUnitId;
        }

        $defaultUnitId = DB::table('units')
            ->orderByDesc('is_default')
            ->orderBy('created_at')
            ->value('id');

        $this->fallbackUnitId = $defaultUnitId ? (string) $defaultUnitId : null;

        return $this->fallbackUnitId;
    }

    protected function resolveDefaultBranchId(): ?string {
        if ($this->fallbackBranchId !== null) {
            return $this->fallbackBranchId;
        }

        $branchId = DB::table('branches')
            ->where('is_main_branch', true)
            ->whereNull('branchable_type')
            ->whereNull('branchable_id')
            ->orderByDesc('is_main_branch')
            ->orderBy('created_at')
            ->value('id');

        $this->fallbackBranchId = $branchId ? (string) $branchId : null;

        return $this->fallbackBranchId;
    }

    protected function resolvePermissionIdByModel(string $modelClass): ?string {
        if (array_key_exists($modelClass, $this->permissionIdCache)) {
            return $this->permissionIdCache[$modelClass];
        }

        $permissionId = DB::table('permissions')
            ->where('model', $modelClass)
            ->value('id');

        $this->permissionIdCache[$modelClass] = $permissionId ? (string) $permissionId : null;

        return $this->permissionIdCache[$modelClass];
    }

    /**
     * @return array<int, FormStatus>
     */
    protected function defaultLegacyStatus(): array {
        return [FormStatus::DRAFT];
    }

    /**
     * Execute the migration logic.
     */
    abstract public function migrate(): void;

    /**
     * Log progress to console and file.
     */
    protected function log(string $message, string $level = 'info'): void {
        $msg = "[Migration] $message";
        match ($level) {
            'emergency' => Log::emergency($msg),
            'alert'     => Log::alert($msg),
            'critical'  => Log::critical($msg),
            'error'     => Log::error($msg),
            'warning'   => Log::warning($msg),
            'notice'    => Log::notice($msg),
            'debug'     => Log::debug($msg),
            default     => Log::info($msg),
        };

        if (app()->runningInConsole()) {
            echo "$msg\n";
        }
    }

    /**
     * Transform data based on a mapping array.
     */
    protected function transform(array $sourceData, array $mapping): array {
        $targetData = [];
        foreach ($mapping as $targetKey => $sourceKeyOrCallback) {
            if (is_callable($sourceKeyOrCallback)) {
                // If it's a Closure, we pass the row to handle complex data type conversions
                $targetData[$targetKey] = $sourceKeyOrCallback($sourceData);
            } else {
                $targetData[$targetKey] = $sourceData[$sourceKeyOrCallback] ?? null;
            }
        }

        return $targetData;
    }

    /**
     * Mencatat riwayat migrasi ke model Log aplikasi.
     */
    protected function recordModelLog(string $modelClass, string $modelId, array $data): void {
        if (! class_exists($modelClass)) {
            $this->log("Model {$modelClass} tidak ditemukan. Pencatatan log dilewati.", 'warning');

            return;
        }

        $model = new $modelClass;
        if (! $model instanceof Model) {
            $this->log("Model {$modelClass} bukan Eloquent model. Pencatatan log dilewati.", 'warning');

            return;
        }

        $dataAfter = $data;

        // Filter kolom yang akan di-log agar sama persis seperti trait DataTable
        $keys = $this->resolveLogableFields($model, $data);
        if ($keys !== []) {
            $dataAfter = \array_replace(
                \array_fill_keys($keys, null),
                \array_intersect_key($data, array_flip($keys)),
            );
        }

        ActivityLog::create([
            'activity' => [
                'en' => 'Migrated from Legacy System',
                'id' => 'Migrasi dari Sistem Lama',
            ],
            'data_before'   => null,
            'data_after'    => $dataAfter,
            'loggable_type' => $modelClass,
            'loggable_id'   => $modelId,
            'user_id'       => null, // Akan bernilai null jika dijalankan via console
        ]);
    }

    /**
     * @return array<int, string>
     */
    protected function resolveLogableFields(Model $model, array $data): array {
        if (! method_exists($model, 'logableFields')) {
            return [];
        }

        try {
            $model->setRawAttributes($data);
            $method   = 'logableFields';
            $resolver = \Closure::bind(function () use ($method): mixed {
                return $this->{$method}();
            }, $model, $model);
            $keys = $resolver ? $resolver() : [];

            return is_array($keys) ? $keys : [];
        } catch (Throwable $exception) {
            $this->log('Gagal membaca logableFields pada ' . get_class($model) . ': ' . $exception->getMessage(), 'warning');

            return [];
        }
    }
}
