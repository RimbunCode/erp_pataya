<?php

namespace App\Services\Migration\Migrators\Inventory\Warehouses;

use App\Models\Inventory\Warehouse;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class WarehouseMigrator extends BaseMigrator {
    protected string $sourceTable           = 'location';
    protected string $sourcePrimaryKey      = 'id';
    protected string $sourceLocationCodeKey = 'location.loc_code';
    protected string $targetTable           = 'warehouses';
    protected string $targetModel           = Warehouse::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        $defaultBranchId = $this->resolveDefaultBranchId();
        if ($defaultBranchId === null) {
            throw new RuntimeException('Tidak ada branch di ERP. Migrasi warehouse membutuhkan minimal 1 branch.');
        }

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records) use ($defaultBranchId): void {
                foreach ($records as $record) {
                    $legacyId   = $record->{$this->sourcePrimaryKey};
                    $existingId = $this->getNewId($this->sourceTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $rawCode = $this->nullableString($record->loc_code) ?? "WH-{$legacyId}";
                    $code    = $this->ensureUniqueCode($rawCode, $defaultBranchId, $newUlid, (string) $legacyId);

                    $mappedData = [
                        'id'                => $newUlid,
                        'branch_id'         => $defaultBranchId,
                        'name'              => $this->nullableString($record->location_name) ?? "Legacy Warehouse {$legacyId}",
                        'code'              => $code,
                        'user_id'           => null,
                        'created_at'        => $record->created_at,
                        'updated_at'        => $record->updated_at,
                        'deleted_at'        => ((int) ($record->inactive ?? 0)) === 1 ? ($record->updated_at ?? $record->created_at ?? now()) : null,
                        'have_transactions' => false,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $legacyId, $newUlid);

                    $legacyCode = $this->nullableString($record->loc_code);
                    if ($legacyCode !== null) {
                        $this->mapId($this->sourceLocationCodeKey, $legacyCode, $newUlid);
                    }

                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function ensureUniqueCode(string $code, string $branchId, string $targetId, string $legacyId): string {
        $normalizedCode = trim($code);
        if ($normalizedCode === '') {
            $normalizedCode = "WH-{$legacyId}";
        }

        $exists = DB::table($this->targetTable)
            ->where('branch_id', $branchId)
            ->where('code', $normalizedCode)
            ->whereNull('deleted_at')
            ->where('id', '!=', $targetId)
            ->exists();

        if (! $exists) {
            return $normalizedCode;
        }

        return "{$normalizedCode}-{$legacyId}";
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

