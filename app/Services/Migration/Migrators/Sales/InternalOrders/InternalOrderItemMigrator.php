<?php

namespace App\Services\Migration\Migrators\Sales\InternalOrders;

use App\Models\Sales\InternalOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InternalOrderItemMigrator extends BaseMigrator {
    protected string $sourceTable        = 'internal_order_details';
    protected string $sourcePrimaryKey   = 'id';
    protected string $sourceStockCodeKey = 'item_code.stock_id';
    protected string $targetTable        = 'internal_order_items';
    protected string $targetModel        = InternalOrderItem::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $internalOrderId = $this->getNewId('internal_orders', $record->internal_order_id ?? null);
                    if ($internalOrderId === null) {
                        $this->log("Lewati detail IO {$record->{$this->sourcePrimaryKey}} karena internal_order belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail IO {$record->{$this->sourcePrimaryKey}} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);

                    $mappedData = [
                        'id'                  => $newUlid,
                        'internal_order_id'   => $internalOrderId,
                        'item_id'             => $itemVariantId,
                        'unit_id'             => $unitId,
                        'source_warehouse_id' => null,
                        'referenceable_type'  => null,
                        'referenceable_id'    => null,
                        'conversion_factor'   => 1,
                        'quantity'            => (float) ($record->qty ?? 0),
                        'delivered_quantity'  => (float) ($record->qty_sent ?? 0),
                        'description'         => $this->nullableString($record->description),
                        'created_at'          => $record->created_at,
                        'updated_at'          => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceTable, $record->{$this->sourcePrimaryKey}, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->sourceTable} selesai.");
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

