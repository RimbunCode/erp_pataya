<?php

namespace App\Services\Migration\Migrators\Inventory\DeliveryItem;

use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryNoteItemMigrator extends BaseMigrator {
    protected string $sourceSalesDetailTable       = 'shipment_details';
    protected string $sourceInternalDetailTable    = 'shipment_io_details';
    protected string $sourcePrimaryKey             = 'id';
    protected string $sourceSalesHeaderTable       = 'shipment';
    protected string $sourceInternalHeaderTable    = 'shipment_ios';
    protected string $sourceSalesOrderTable        = 'sales_orders';
    protected string $sourceInternalOrderTable     = 'internal_orders';
    protected string $sourceStockCodeKey           = 'item_code.stock_id';
    protected string $sourceLocationCodeKey        = 'location.loc_code';
    protected string $targetTable                  = 'delivery_note_items';
    protected string $targetModel                  = DeliveryNoteItem::class;
    protected string $targetSalesOrderItemTable    = 'sales_order_items';
    protected string $targetInternalOrderItemTable = 'internal_order_items';

    /**
     * @var array<string, string|null>
     */
    protected array $legacySalesOrderWarehouseCache = [];

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceSalesDetailTable}/{$this->sourceInternalDetailTable} -> {$this->targetTable}");

        $this->migrateSalesShipmentItems();
        $this->migrateInternalShipmentItems();

        $this->log('Migrasi delivery note items selesai.');
    }

    protected function migrateSalesShipmentItems(): void {
        DB::connection($this->sourceConnection)
            ->table($this->sourceSalesDetailTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyId = $record->{$this->sourcePrimaryKey};

                    $deliveryNoteId = $this->getNewId($this->sourceSalesHeaderTable, $record->shipment_id ?? null);
                    if ($deliveryNoteId === null) {
                        $this->log("Lewati shipment detail {$legacyId} karena delivery_note belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati shipment detail {$legacyId} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $unitId = $this->resolveDefaultUnitId($itemVariantId);
                    if ($unitId === null) {
                        $this->log("Lewati shipment detail {$legacyId} karena unit default item tidak ditemukan.", 'warning');

                        continue;
                    }

                    $referenceableId = $this->resolveSalesOrderItemId($record->order_no ?? null, $itemVariantId);
                    if ($referenceableId === null) {
                        $this->log("Lewati shipment detail {$legacyId} karena sales_order_item tidak ditemukan.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceSalesDetailTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'                     => $newUlid,
                        'referenceable_type'     => SalesOrderItem::class,
                        'referenceable_id'       => $referenceableId,
                        'source_warehouse_id'    => $this->resolveSourceWarehouseFromSalesOrder($record->order_no ?? null),
                        'delivery_note_id'       => $deliveryNoteId,
                        'item_id'                => $itemVariantId,
                        'unit_id'                => $unitId,
                        'conversion_factor'      => 1,
                        'valuation_rates'        => [],
                        'quantity'               => max((float) ($record->quantity ?? 0), 0),
                        'returned_quantity'      => max((float) ($record->qty_retur ?? 0), 0),
                        'description'            => null,
                        'return_against_item_id' => null,
                        'deleted_at'             => null,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceSalesDetailTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });
    }

    protected function migrateInternalShipmentItems(): void {
        DB::connection($this->sourceConnection)
            ->table($this->sourceInternalDetailTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyId = $record->{$this->sourcePrimaryKey};

                    $deliveryNoteId = $this->getNewId($this->sourceInternalHeaderTable, $record->shipment_io_id ?? null);
                    if ($deliveryNoteId === null) {
                        $this->log("Lewati shipment_io detail {$legacyId} karena delivery_note belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati shipment_io detail {$legacyId} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $unitId = $this->resolveDefaultUnitId($itemVariantId);
                    if ($unitId === null) {
                        $this->log("Lewati shipment_io detail {$legacyId} karena unit default item tidak ditemukan.", 'warning');

                        continue;
                    }

                    $referenceableId = $this->resolveInternalOrderItemId($record->internal_order_id ?? null, $itemVariantId);
                    if ($referenceableId === null) {
                        $this->log("Lewati shipment_io detail {$legacyId} karena internal_order_item tidak ditemukan.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceInternalDetailTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $mappedData = [
                        'id'                     => $newUlid,
                        'referenceable_type'     => InternalOrderItem::class,
                        'referenceable_id'       => $referenceableId,
                        'source_warehouse_id'    => null,
                        'delivery_note_id'       => $deliveryNoteId,
                        'item_id'                => $itemVariantId,
                        'unit_id'                => $unitId,
                        'conversion_factor'      => 1,
                        'valuation_rates'        => [],
                        'quantity'               => max((float) ($record->quantity ?? 0), 0),
                        'returned_quantity'      => 0,
                        'description'            => null,
                        'return_against_item_id' => null,
                        'deleted_at'             => null,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceInternalDetailTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });
    }

    protected function resolveSalesOrderItemId(mixed $legacyOrderNo, string $itemVariantId): ?string {
        if ((string) ($legacyOrderNo ?? '') === '') {
            return null;
        }

        $salesOrderId = $this->getNewId($this->sourceSalesOrderTable, $legacyOrderNo);
        if ($salesOrderId === null) {
            return null;
        }

        $salesOrderItemId = DB::table($this->targetSalesOrderItemTable)
            ->where('sales_order_id', $salesOrderId)
            ->where('item_id', $itemVariantId)
            ->orderBy('created_at')
            ->value('id');

        return $salesOrderItemId ? (string) $salesOrderItemId : null;
    }

    protected function resolveInternalOrderItemId(mixed $legacyInternalOrderId, string $itemVariantId): ?string {
        if ((string) ($legacyInternalOrderId ?? '') === '') {
            return null;
        }

        $internalOrderId = $this->getNewId($this->sourceInternalOrderTable, $legacyInternalOrderId);
        if ($internalOrderId === null) {
            return null;
        }

        $internalOrderItemId = DB::table($this->targetInternalOrderItemTable)
            ->where('internal_order_id', $internalOrderId)
            ->where('item_id', $itemVariantId)
            ->orderBy('created_at')
            ->value('id');

        return $internalOrderItemId ? (string) $internalOrderItemId : null;
    }

    protected function resolveSourceWarehouseFromSalesOrder(mixed $legacyOrderNo): ?string {
        $cacheKey = (string) ($legacyOrderNo ?? '');
        if ($cacheKey !== '' && array_key_exists($cacheKey, $this->legacySalesOrderWarehouseCache)) {
            return $this->legacySalesOrderWarehouseCache[$cacheKey];
        }

        $legacyLocationCode = DB::connection($this->sourceConnection)
            ->table($this->sourceSalesOrderTable)
            ->where('order_no', $legacyOrderNo)
            ->value('from_stk_loc');

        $warehouseId  = null;
        $locationCode = trim((string) ($legacyLocationCode ?? ''));
        if ($locationCode !== '') {
            $warehouseId = $this->getNewId($this->sourceLocationCodeKey, $locationCode);
        }

        if ($cacheKey !== '') {
            $this->legacySalesOrderWarehouseCache[$cacheKey] = $warehouseId;
        }

        return $warehouseId;
    }
}

