<?php

namespace App\Services\Migration\Migrators\Inventory\Units;

use App\Models\Inventory\Unit;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UnitMigrator extends BaseMigrator {
    protected string $sourceTable      = 'item_units';
    protected string $sourcePrimaryKey = 'id';
    protected string $targetTable      = 'units';
    protected string $targetModel      = Unit::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        $sourceData = [
            [
                'id'   => '1',
                'code' => 'Pcs',
                'name' => 'Piece',
            ], [
                'id'   => '2',
                'code' => 'Pail',
                'name' => 'Pail',
            ], [
                'id'   => '3',
                'code' => 'Set',
                'name' => 'Set',
            ], [
                'id'   => '4',
                'code' => 'Unit',
                'name' => 'Unit',
            ], [
                'id'   => '5',
                'code' => 'Kit',
                'name' => 'Kit',
            ], [
                'id'   => '6',
                'code' => 'Jam',
                'name' => 'Jam',
            ], [
                'id'   => '7',
                'code' => 'Ltr',
                'name' => 'Liter',
            ], [
                'id'   => '8',
                'code' => 'Ls',
                'name' => 'Lumpsum',
            ], [
                'id'   => '9',
                'code' => 'M',
                'name' => 'Meter',
            ], [
                'id'   => '10',
                'code' => 'M3',
                'name' => 'Meter Kubik',
            ], [
                'id'   => '11',
                'code' => 'Bln',
                'name' => 'Bulan',
            ], [
                'id'   => '12',
                'code' => 'DRM',
                'name' => 'DRUM',
            ], [
                'id'   => '13',
                'code' => 'Hari',
                'name' => 'Hari',
            ], [
                'id'   => '14',
                'code' => 'INV',
                'name' => 'INVENTARIS',
            ],
        ];
        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyCode = $record->abbr;

                    if ($legacyCode === '') {
                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceTable, $legacyCode);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'                => $newUlid,
                        'code'              => $legacyCode,
                        'name'              => $this->nullableString($record->name ?? null) ?? $legacyCode,
                        'group'             => 'General',
                        'conversion_factor' => 1,
                        'is_default'        => false,
                        'created_at'        => $record->created_at ?? now(),
                        'updated_at'        => $record->updated_at ?? now(),
                        'deleted_at'        => ((int) ($record->inactive ?? 0)) === 1 ? ($record->updated_at ?? now()) : null,
                        'have_transactions' => false,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $legacyCode, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function shouldMarkAsDefault(string $legacyCode, string $targetId): bool {
        $defaultCodeCandidates = ['pc', 'pcs', 'unit'];
        if (\in_array(strtolower($legacyCode), $defaultCodeCandidates, true)) {
            return true;
        }

        return ! DB::table($this->targetTable)
            ->where('is_default', true)
            ->where('id', '!=', $targetId)
            ->exists();
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}
