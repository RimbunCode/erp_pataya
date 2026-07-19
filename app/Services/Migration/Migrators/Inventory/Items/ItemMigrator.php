<?php

namespace App\Services\Migration\Migrators\Inventory\Items;

use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Services\Inventory\ItemServices;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ItemMigrator extends BaseMigrator {
    /**
     * Nama tabel sumber di database legacy.
     * Legacy tidak mengenal variant — 1 baris `item_code` menghasilkan 1 Item + 1 ItemVariant
     * tunggal (format_variant = null), mengikuti alur `ItemServices::updateVariants()` saat
     * item tidak punya attribute/variant.
     */
    protected string $sourceTable = 'item_code';

    /**
     * Model tujuan untuk pencatatan Log.
     */
    protected string $targetModel = Item::class;

    /**
     * Execute the migration logic.
     */
    public function migrate(): void {
        $this->log("Memulai migrasi untuk tabel: {$this->sourceTable}");

        $categories    = Category::query()->pluck('default_unit_id', 'id');
        $categoryTypes = Category::query()->pluck('type', 'id');
        $itemServices  = new ItemServices;

        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourceTable),
            'item_code',
            'id',
            function ($record) use ($categories, $categoryTypes, $itemServices) {
                $categoryId    = $this->getNewId('stock_category', $record->category_id);
                $defaultUnitId = $categoryId ? ($categories[$categoryId] ?? null) : null;
                $categoryType  = $categoryId ? ($categoryTypes[$categoryId] ?? 'inventory') : 'inventory';

                $mappedData = $this->transform((array) $record, [
                    'code'            => 'stock_id',
                    'name'            => 'description',
                    'description'     => fn ($row) => $row['description'] !== '' ? $row['description'] : null,
                    'category_id'     => fn () => $categoryId,
                    'default_unit_id' => fn () => $defaultUnitId,
                    'stock_minimum'   => fn ($row) => (int) $row['minimum'],
                    'is_disabled'     => fn ($row) => (bool) $row['inactive'] || (bool) $row['deleted_status'],
                    'is_stock_item'   => fn () => $categoryType !== 'service',
                    'type'            => fn () => $categoryType,
                ]);

                $newUlid                  = (string) Str::ulid();
                $mappedData['id']         = $newUlid;
                $mappedData['created_at'] = $record->created_at ?? now();
                $mappedData['updated_at'] = $record->updated_at ?? now();

                DB::table('items')->updateOrInsert(['id' => $newUlid], $mappedData);

                $this->mapId($this->sourceTable, $record->id, $newUlid);

                $this->recordModelLog($this->targetModel, $newUlid, $mappedData);

                $item = Item::find($newUlid);
                if ($item && $defaultUnitId) {
                    $itemServices->updateUom($item, [
                        ['id' => $defaultUnitId, 'conversion_factor' => 1, 'isManual' => false, 'generatedByDefaultUnit' => true],
                    ]);
                }
                if ($item) {
                    $itemServices->updateVariants($item, '', []);
                }
            },
        );

        $this->log("Migrasi {$this->sourceTable} selesai sepenuhnya.");
    }
}
