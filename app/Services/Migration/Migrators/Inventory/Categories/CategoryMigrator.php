<?php

namespace App\Services\Migration\Migrators\Inventory\Categories;

use App\Models\Inventory\Category;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategoryMigrator extends BaseMigrator {
    protected string $sourceTable      = 'stock_category';
    protected string $sourcePrimaryKey = 'category_id';
    protected string $targetTable      = 'categories';
    protected string $targetModel      = Category::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyId   = $record->{$this->sourcePrimaryKey};
                    $existingId = $this->getNewId($this->sourceTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'                => $newUlid,
                        'name'              => $this->buildName($record),
                        'type'              => $this->resolveType($record),
                        'have_transactions' => false,
                        'created_at'        => $record->created_at,
                        'updated_at'        => $record->updated_at,
                        'deleted_at'        => null,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function buildName(object $record): string {
        $name = trim((string) ($record->description ?? ''));

        if ($name !== '') {
            return $name;
        }

        return "Legacy Category {$record->{$this->sourcePrimaryKey}}";
    }

    protected function resolveType(object $record): string {
        if ((int) ($record->is_services ?? 0) === 1) {
            return 'service';
        }

        if ((int) ($record->is_vehicles ?? 0) === 1) {
            return 'vehicle';
        }

        return 'stock';
    }
}

