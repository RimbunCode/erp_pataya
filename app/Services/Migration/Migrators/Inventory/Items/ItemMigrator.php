<?php

namespace App\Services\Migration\Migrators\Inventory\Items;

use App\Models\Inventory\ItemVariant;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ItemMigrator extends BaseMigrator {
    protected string $sourceTable          = 'item_code';
    protected string $sourcePrimaryKey     = 'id';
    protected string $sourceStockCodeKey   = 'item_code.stock_id';
    protected string $targetTable          = 'items';
    protected string $targetVariantTable   = 'item_variants';
    protected string $targetModel          = ItemVariant::class;
    protected ?string $defaultCategoryId   = null;
    protected ?string $defaultUnitIdCached = null;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable} & {$this->targetVariantTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingVariantId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $itemVariantId     = $existingVariantId ?? (string) Str::ulid();
                    $itemId            = (string) Str::ulid();

                    if ($existingVariantId !== null) {
                        $itemId = (string) (DB::table($this->targetVariantTable)
                            ->where('id', $existingVariantId)
                            ->value('item_id') ?? $itemId);
                    }

                    $defaultUnitId = $this->resolveDefaultUnitIdFromLegacy();
                    $itemCode      = trim((string) ($record->stock_id ?: "ITEM-{$record->{$this->sourcePrimaryKey}}"));
                    $itemName      = trim((string) ($record->description ?: $itemCode));

                    $itemData = [
                        'id'                     => $itemId,
                        'code'                   => $itemCode,
                        'name'                   => $itemName,
                        'description'            => $this->nullableString($record->description),
                        'category_id'            => $this->resolveDefaultCategoryId(),
                        'default_unit_id'        => $defaultUnitId,
                        'conversion_factor'      => 1,
                        'stock_minimum'          => max((int) ($record->minimum ?? 0), 0),
                        'image_id'               => null,
                        'is_disabled'            => ((int) ($record->inactive ?? 0)) === 1,
                        'allow_alternative_item' => false,
                        'is_stock_item'          => true,
                        'type'                   => 'stock',
                        'format_variant'         => null,
                        'have_transactions'      => false,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $itemId],
                        $itemData,
                    );

                    $variantData = [
                        'id'                     => $itemVariantId,
                        'code'                   => $itemCode,
                        'item_id'                => $itemId,
                        'category_id'            => $this->resolveDefaultCategoryId(),
                        'default_unit_id'        => $defaultUnitId,
                        'item_code'              => $itemCode,
                        'item_name'              => $itemName,
                        'format_variant'         => null,
                        'description'            => $this->nullableString($record->description),
                        'is_disabled'            => ((int) ($record->inactive ?? 0)) === 1,
                        'allow_alternative_item' => false,
                        'conversion_factor'      => 1,
                        'is_stock_item'          => true,
                        'type'                   => 'stock',
                        'have_transactions'      => false,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                    ];

                    DB::table($this->targetVariantTable)->updateOrInsert(
                        ['id' => $itemVariantId],
                        $variantData,
                    );

                    $legacyId        = $record->{$this->sourcePrimaryKey};
                    $legacyStockCode = (string) ($record->stock_id ?? '');

                    $this->mapId($this->sourceTable, $legacyId, $itemVariantId);
                    if ($legacyStockCode !== '') {
                        $this->mapId($this->sourceStockCodeKey, $legacyStockCode, $itemVariantId);
                    }

                    $this->recordModelLog($this->targetModel, $itemVariantId, $variantData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function resolveDefaultCategoryId(): ?string {
        if ($this->defaultCategoryId !== null) {
            return $this->defaultCategoryId;
        }

        $categoryId = DB::table('categories')
            ->orderBy('created_at')
            ->value('id');

        $this->defaultCategoryId = $categoryId ? (string) $categoryId : null;

        return $this->defaultCategoryId;
    }

    protected function resolveDefaultUnitIdFromLegacy(): ?string {
        if ($this->defaultUnitIdCached !== null) {
            return $this->defaultUnitIdCached;
        }

        $this->defaultUnitIdCached = $this->resolveDefaultUnitId();

        return $this->defaultUnitIdCached;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

