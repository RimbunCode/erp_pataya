<?php

namespace App\Services\Migration\Migrators\Purchase\Orders;

use App\Models\Purchase\PurchaseOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseOrderItemMigrator extends BaseMigrator {
    protected string $sourceTable        = 'purch_order_details';
    protected string $sourcePrimaryKey   = 'po_detail_item';
    protected string $sourceStockCodeKey = 'item_code.stock_id';
    protected string $targetTable        = 'purchase_order_items';
    protected string $targetModel        = PurchaseOrderItem::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $purchaseOrderId = $this->getNewId('purch_orders', $record->order_no ?? null);
                    if ($purchaseOrderId === null) {
                        $this->log("Lewati detail PO {$record->{$this->sourcePrimaryKey}} karena purchase_order belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->item_code ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail PO {$record->{$this->sourcePrimaryKey}} karena item {$record->item_code} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);
                    $unitName   = $unitId ? DB::table('units')->where('id', $unitId)->value('name') : null;

                    $mappedData = [
                        'id'                  => $newUlid,
                        'purchase_order_id'   => $purchaseOrderId,
                        'referenceable_type'  => null,
                        'referenceable_id'    => null,
                        'item_id'             => $itemVariantId,
                        'item_name'           => $this->nullableString($record->description),
                        'required_date'       => null,
                        'target_warehouse_id' => null,
                        'quantity'            => (float) ($record->quantity_ordered ?? 0),
                        'received_quantity'   => max((float) ($record->quantity_received ?? 0), (float) ($record->qty_received ?? 0)),
                        'billed_quantity'     => (float) ($record->qty_invoiced ?? 0),
                        'unit_id'             => $unitId,
                        'unit_name'           => $unitName,
                        'conversion_factor'   => 1,
                        'description'         => $this->nullableString($record->description),
                        'tax_id'              => null,
                        'tax_rate'            => 0,
                        'rate'                => (float) ($record->unit_price ?? 0),
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

