<?php

namespace App\Services\Migration\Migrators\Service\WorkOrders;

use App\Models\Service\WorkOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkOrderItemMigrator extends BaseMigrator {
    protected string $sourceTable        = 'breakdown_details';
    protected string $sourcePrimaryKey   = 'id';
    protected string $sourceStockCodeKey = 'item_code.stock_id';
    protected string $targetTable        = 'work_order_items';
    protected string $targetModel        = WorkOrderItem::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $workOrderId = $this->getNewId('breakdown', $record->breakdown_no ?? null);
                    if ($workOrderId === null) {
                        $this->log("Lewati detail WO {$record->{$this->sourcePrimaryKey}} karena work_order belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail WO {$record->{$this->sourcePrimaryKey}} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);
                    $unitName   = $unitId ? DB::table('units')->where('id', $unitId)->value('name') : null;

                    $mappedData = [
                        'id'                   => $newUlid,
                        'referenceable_type'   => null,
                        'referenceable_id'     => null,
                        'work_order_id'        => $workOrderId,
                        'item_variant_id'      => $itemVariantId,
                        'item_name'            => $this->nullableString($record->description),
                        'quantity'             => (float) ($record->quantity ?? 0),
                        'ordered_quantity'     => (float) ($record->receive_qty ?? 0),
                        'received_quantity'    => (float) ($record->receive_qty ?? 0),
                        'transferred_quantity' => 0,
                        'unit_id'              => $unitId,
                        'unit_name'            => $unitName,
                        'conversion_factor'    => 1,
                        'description'          => $this->nullableString($record->description),
                        'created_at'           => $record->created_at,
                        'updated_at'           => $record->updated_at,
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

