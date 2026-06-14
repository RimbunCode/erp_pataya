<?php

namespace App\Services\Migration\Migrators\Purchase\Requests;

use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Service\WorkOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseRequestItemMigrator extends BaseMigrator {
    protected string $sourceTable              = 'requisition_details';
    protected string $sourcePrimaryKey         = 'id';
    protected string $sourceHeaderTable        = 'requisition';
    protected string $sourceStockCodeKey       = 'item_code.stock_id';
    protected string $targetTable              = 'purchase_request_items';
    protected string $targetModel              = PurchaseRequestItem::class;
    protected string $targetWorkOrderItemTable = 'work_order_items';

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table("{$this->sourceTable} as details")
            ->leftJoin("{$this->sourceHeaderTable} as header", 'header.id', '=', 'details.requisition_no')
            ->select([
                'details.*',
                'header.transaction_date as header_transaction_date',
                'header.breakdown_reference_id as header_breakdown_reference_id',
            ])
            ->orderBy("details.{$this->sourcePrimaryKey}")
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $purchaseRequestId = $this->getNewId($this->sourceHeaderTable, $record->requisition_no ?? null);
                    if ($purchaseRequestId === null) {
                        $this->log("Lewati detail PR {$record->{$this->sourcePrimaryKey}} karena purchase_request belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail PR {$record->{$this->sourcePrimaryKey}} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $legacyId   = $record->{$this->sourcePrimaryKey};
                    $existingId = $this->getNewId($this->sourceTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);
                    $unitName   = $unitId ? DB::table('units')->where('id', $unitId)->value('name') : null;

                    [$referenceableType, $referenceableId] = $this->resolveReferenceable(
                        $record->header_breakdown_reference_id ?? null,
                        $itemVariantId,
                    );

                    $quantity = (float) ($record->quantity ?? 0);
                    if ($quantity <= 0) {
                        $quantity = (float) ($record->qty_need ?? 0);
                    }

                    $mappedData = [
                        'id'                  => $newUlid,
                        'purchase_request_id' => $purchaseRequestId,
                        'referenceable_type'  => $referenceableType,
                        'referenceable_id'    => $referenceableId,
                        'item_variant_id'     => $itemVariantId,
                        'item_name'           => $this->nullableString($record->description),
                        'required_date'       => $this->resolveDateTime($record->header_transaction_date ?? null, $record->created_at ?? null),
                        'quantity'            => max($quantity, 0),
                        'ordered_quantity'    => 0,
                        'received_quantity'   => 0,
                        'unit_id'             => $unitId,
                        'unit_name'           => $unitName,
                        'conversion_factor'   => 1,
                        'description'         => $this->nullableString($record->description),
                        'created_at'          => $record->created_at,
                        'updated_at'          => $record->updated_at,
                        'deleted_at'          => null,
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

    /**
     * @return array{0: ?string, 1: ?string}
     */
    protected function resolveReferenceable(mixed $legacyWorkOrderId, string $itemVariantId): array {
        if ((string) ($legacyWorkOrderId ?? '') === '' || (float) ($legacyWorkOrderId ?? 0) <= 0) {
            return [null, null];
        }

        $workOrderId = $this->getNewId('breakdown', $legacyWorkOrderId);
        if ($workOrderId === null) {
            return [null, null];
        }

        $workOrderItemId = DB::table($this->targetWorkOrderItemTable)
            ->where('work_order_id', $workOrderId)
            ->where('item_variant_id', $itemVariantId)
            ->orderBy('created_at')
            ->value('id');

        if ($workOrderItemId === null) {
            return [null, null];
        }

        return [WorkOrderItem::class, (string) $workOrderItemId];
    }

    protected function resolveDateTime(mixed $primaryDate, mixed $fallbackDate = null): string {
        $resolved = $this->nullableString($primaryDate)
            ?? $this->nullableString($fallbackDate)
            ?? now()->toDateTimeString();

        return $resolved;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

