<?php

namespace App\Services\Migration\Migrators\Purchase\Receipts;

use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseReceiptItemMigrator extends BaseMigrator {
    protected string $sourceTable                  = 'receive_order_details';
    protected string $sourcePrimaryKey             = 'id';
    protected string $sourceHeaderTable            = 'receive_orders';
    protected string $sourcePurchaseOrderTable     = 'purch_orders';
    protected string $sourceStockCodeKey           = 'item_code.stock_id';
    protected string $sourceLocationCodeKey        = 'location.loc_code';
    protected string $targetTable                  = 'purchase_receipt_items';
    protected string $targetModel                  = PurchaseReceiptItem::class;
    protected string $targetPurchaseOrderItemTable = 'purchase_order_items';

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table("{$this->sourceTable} as details")
            ->leftJoin("{$this->sourceHeaderTable} as header", 'header.id', '=', 'details.receive_id')
            ->select([
                'details.*',
                'header.location as header_location',
                'header.order_no as header_order_no',
            ])
            ->orderBy("details.{$this->sourcePrimaryKey}")
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $purchaseReceiptId = $this->getNewId($this->sourceHeaderTable, $record->receive_id ?? null);
                    if ($purchaseReceiptId === null) {
                        $this->log("Lewati detail receipt {$record->{$this->sourcePrimaryKey}} karena purchase_receipt belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->item_code ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail receipt {$record->{$this->sourcePrimaryKey}} karena item {$record->item_code} belum termigrasi.", 'warning');

                        continue;
                    }

                    $legacyId   = $record->{$this->sourcePrimaryKey};
                    $existingId = $this->getNewId($this->sourceTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);
                    $unitName   = $unitId ? DB::table('units')->where('id', $unitId)->value('name') : null;

                    $targetWarehouseId   = $this->resolveTargetWarehouseId($record->header_location ?? null);
                    $purchaseOrderItemId = $this->resolvePurchaseOrderItemId(
                        $record->header_order_no ?? $record->order_no ?? null,
                        $itemVariantId,
                    );

                    $mappedData = [
                        'id'                     => $newUlid,
                        'purchase_receipt_id'    => $purchaseReceiptId,
                        'purchase_order_item_id' => $purchaseOrderItemId,
                        'item_id'                => $itemVariantId,
                        'item_name'              => $this->nullableString($record->description),
                        'unit_id'                => $unitId,
                        'unit_name'              => $unitName,
                        'conversion_factor'      => 1,
                        'target_warehouse_id'    => $targetWarehouseId,
                        'description'            => $this->nullableString($record->comments) ?? $this->nullableString($record->description),
                        'quantity'               => max((float) ($record->quantity ?? 0), 0),
                        'returned_quantity'      => max((float) ($record->qty_retur ?? 0), 0),
                        'return_against_item_id' => null,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                        'deleted_at'             => null,
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

    protected function resolveTargetWarehouseId(mixed $legacyLocationCode): ?string {
        $locationCode = $this->nullableString($legacyLocationCode);
        if ($locationCode === null) {
            return null;
        }

        return $this->getNewId($this->sourceLocationCodeKey, $locationCode);
    }

    protected function resolvePurchaseOrderItemId(mixed $legacyOrderNo, string $itemVariantId): ?string {
        if ((string) ($legacyOrderNo ?? '') === '') {
            return null;
        }

        $purchaseOrderId = $this->getNewId($this->sourcePurchaseOrderTable, $legacyOrderNo);
        if ($purchaseOrderId === null) {
            return null;
        }

        $itemId = DB::table($this->targetPurchaseOrderItemTable)
            ->where('purchase_order_id', $purchaseOrderId)
            ->where('item_id', $itemVariantId)
            ->orderBy('created_at')
            ->value('id');

        return $itemId ? (string) $itemId : null;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

