<?php

namespace App\Services\Migration\Migrators\Inventory\DeliveryItem;

use App\Enums\FormStatus;
use App\Models\Inventory\DeliveryNote;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryNoteMigrator extends BaseMigrator {
    protected string $sourceSalesTable         = 'shipment';
    protected string $sourceInternalTable      = 'shipment_ios';
    protected string $sourcePrimaryKey         = 'id';
    protected string $sourceSalesOrderTable    = 'sales_orders';
    protected string $sourceInternalOrderTable = 'internal_orders';
    protected string $targetTable              = 'delivery_notes';
    protected string $targetModel              = DeliveryNote::class;

    /**
     * @var array<string, string>
     */
    protected array $legacySalesOrderCreatorCache = [];

    /**
     * @var array<string, string>
     */
    protected array $legacyInternalOrderCreatorCache = [];

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceSalesTable}/{$this->sourceInternalTable} -> {$this->targetTable}");

        $this->migrateSalesShipments();
        $this->migrateInternalShipments();

        $this->log('Migrasi delivery note selesai.');
    }

    protected function migrateSalesShipments(): void {
        $permissionId = $this->resolvePermissionIdByModel(SalesOrder::class);
        if ($permissionId === null) {
            $this->log('Permission untuk SalesOrder tidak ditemukan. Migrasi shipment dilewati.', 'warning');

            return;
        }

        DB::connection($this->sourceConnection)
            ->table($this->sourceSalesTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records) use ($permissionId): void {
                foreach ($records as $record) {
                    $legacyId     = $record->{$this->sourcePrimaryKey};
                    $salesOrderId = $this->getNewId($this->sourceSalesOrderTable, $record->order_no ?? null);
                    if ($salesOrderId === null) {
                        $this->log("Lewati shipment {$legacyId} karena sales_order {$record->order_no} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceSalesTable, $legacyId);
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $salesOrder = $this->resolveSalesOrderContext($salesOrderId);
                    $code       = $this->ensureUniqueCode($this->buildCode($record, 'DN', $legacyId), $newUlid, (string) $legacyId);

                    $mappedData = [
                        'id'                 => $newUlid,
                        'delivery_date'      => $this->resolveDateTime($record->delivery_date, $record->packed_date ?? null, $record->created_at ?? null),
                        'reference_to_id'    => $permissionId,
                        'return_against_id'  => null,
                        'referenceable_type' => SalesOrder::class,
                        'referenceable_id'   => $salesOrderId,
                        'customer_id'        => $salesOrder['customer_id'],
                        'customer_branch_id' => $salesOrder['customer_branch_id'],
                        'external_note'      => $this->nullableString($record->comments),
                        'code'               => $code,
                        'branch_id'          => $salesOrder['branch_id'] ?? $this->resolveDefaultBranchId(),
                        'status'             => $this->mapLegacyStatus($record->status ?? null),
                        'created_by_id'      => $this->resolveCreatedByFromLegacySalesOrder($record->order_no ?? null),
                        'submitted_at'       => null,
                        'canceled_at'        => null,
                        'revision_number'    => 0,
                        'amended_from_id'    => null,
                        'additional_data'    => [
                            'legacy_source_table'       => $this->sourceSalesTable,
                            'legacy_id'                 => $legacyId,
                            'legacy_order_no'           => $record->order_no ?? null,
                            'legacy_trans_type'         => $record->trans_type ?? null,
                            'legacy_status'             => $record->status ?? null,
                            'legacy_packed_date'        => $record->packed_date ?? null,
                            'legacy_comments_receive'   => $record->comments_receive ?? null,
                            'legacy_shipment_reference' => $record->shipment_reference ?? null,
                        ],
                        'deleted_at' => null,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceSalesTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });
    }

    protected function migrateInternalShipments(): void {
        $permissionId = $this->resolvePermissionIdByModel(InternalOrder::class);
        if ($permissionId === null) {
            $this->log('Permission untuk InternalOrder tidak ditemukan. Migrasi shipment_ios dilewati.', 'warning');

            return;
        }

        DB::connection($this->sourceConnection)
            ->table($this->sourceInternalTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records) use ($permissionId): void {
                foreach ($records as $record) {
                    $legacyId        = $record->{$this->sourcePrimaryKey};
                    $internalOrderId = $this->getNewId($this->sourceInternalOrderTable, $record->internal_order_id ?? null);
                    if ($internalOrderId === null) {
                        $this->log("Lewati shipment_ios {$legacyId} karena internal_order {$record->internal_order_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId    = $this->getNewId($this->sourceInternalTable, $legacyId);
                    $newUlid       = $existingId ?? (string) Str::ulid();
                    $internalOrder = $this->resolveInternalOrderContext($internalOrderId);
                    $code          = $this->ensureUniqueCode($this->buildCode($record, 'DIO', $legacyId), $newUlid, (string) $legacyId);

                    $mappedData = [
                        'id'                 => $newUlid,
                        'delivery_date'      => $this->resolveDateTime($record->delivery_date, $record->packed_date ?? null, $record->created_at ?? null),
                        'reference_to_id'    => $permissionId,
                        'return_against_id'  => null,
                        'referenceable_type' => InternalOrder::class,
                        'referenceable_id'   => $internalOrderId,
                        'customer_id'        => null,
                        'customer_branch_id' => $internalOrder['branch_id'],
                        'external_note'      => $this->nullableString($record->comments),
                        'code'               => $code,
                        'branch_id'          => $internalOrder['branch_id'] ?? $this->resolveDefaultBranchId(),
                        'status'             => $this->mapLegacyStatus($record->status ?? null),
                        'created_by_id'      => $this->resolveCreatedByFromLegacyInternalOrder($record->internal_order_id ?? null),
                        'submitted_at'       => null,
                        'canceled_at'        => null,
                        'revision_number'    => 0,
                        'amended_from_id'    => null,
                        'additional_data'    => [
                            'legacy_source_table'       => $this->sourceInternalTable,
                            'legacy_id'                 => $legacyId,
                            'legacy_internal_order_id'  => $record->internal_order_id ?? null,
                            'legacy_status'             => $record->status ?? null,
                            'legacy_packed_date'        => $record->packed_date ?? null,
                            'legacy_comments_receive'   => $record->comments_receive ?? null,
                            'legacy_shipment_reference' => $record->shipment_reference ?? null,
                        ],
                        'deleted_at' => null,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->sourceInternalTable, $legacyId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });
    }

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy shipment ke status ERP.
        return $this->defaultLegacyStatus();
    }

    /**
     * @return array{customer_id: ?string, customer_branch_id: ?string, branch_id: ?string}
     */
    protected function resolveSalesOrderContext(string $salesOrderId): array {
        $record = DB::table('sales_orders')
            ->select(['customer_id', 'customer_branch_id', 'branch_id'])
            ->where('id', $salesOrderId)
            ->first();

        if ($record === null) {
            return [
                'customer_id'        => null,
                'customer_branch_id' => null,
                'branch_id'          => $this->resolveDefaultBranchId(),
            ];
        }

        return [
            'customer_id'        => $record->customer_id ? (string) $record->customer_id : null,
            'customer_branch_id' => $record->customer_branch_id ? (string) $record->customer_branch_id : null,
            'branch_id'          => $record->branch_id ? (string) $record->branch_id : $this->resolveDefaultBranchId(),
        ];
    }

    /**
     * @return array{branch_id: ?string}
     */
    protected function resolveInternalOrderContext(string $internalOrderId): array {
        $branchId = DB::table('internal_orders')
            ->where('id', $internalOrderId)
            ->value('branch_id');

        return [
            'branch_id' => $branchId ? (string) $branchId : $this->resolveDefaultBranchId(),
        ];
    }

    protected function resolveCreatedByFromLegacySalesOrder(mixed $legacyOrderNo): string {
        $cacheKey = (string) ($legacyOrderNo ?? '');
        if ($cacheKey !== '' && array_key_exists($cacheKey, $this->legacySalesOrderCreatorCache)) {
            return $this->legacySalesOrderCreatorCache[$cacheKey];
        }

        $legacyPersonId = DB::connection($this->sourceConnection)
            ->table($this->sourceSalesOrderTable)
            ->where('order_no', $legacyOrderNo)
            ->value('person_id');

        $createdById = $this->resolveCreatedById($legacyPersonId);

        if ($cacheKey !== '') {
            $this->legacySalesOrderCreatorCache[$cacheKey] = $createdById;
        }

        return $createdById;
    }

    protected function resolveCreatedByFromLegacyInternalOrder(mixed $legacyInternalOrderId): string {
        $cacheKey = (string) ($legacyInternalOrderId ?? '');
        if ($cacheKey !== '' && array_key_exists($cacheKey, $this->legacyInternalOrderCreatorCache)) {
            return $this->legacyInternalOrderCreatorCache[$cacheKey];
        }

        $legacyPersonId = DB::connection($this->sourceConnection)
            ->table($this->sourceInternalOrderTable)
            ->where('id', $legacyInternalOrderId)
            ->value('person_id');

        $createdById = $this->resolveCreatedById($legacyPersonId);

        if ($cacheKey !== '') {
            $this->legacyInternalOrderCreatorCache[$cacheKey] = $createdById;
        }

        return $createdById;
    }

    protected function buildCode(object $record, string $prefix, mixed $legacyId): string {
        $legacyReference = $this->nullableString($record->shipment_reference);
        if ($legacyReference !== null) {
            return $legacyReference;
        }

        $year = $this->extractShortYear($record->created_at ?? $record->delivery_date ?? null);

        return "{$prefix}-{$legacyId}/{$year}";
    }

    protected function ensureUniqueCode(string $code, string $targetId, string $legacyId): string {
        $exists = DB::table($this->targetTable)
            ->where('code', $code)
            ->where('id', '!=', $targetId)
            ->exists();

        if (! $exists) {
            return $code;
        }

        return "{$code}-{$legacyId}";
    }

    protected function resolveDateTime(mixed $primaryDate, mixed $secondaryDate = null, mixed $fallbackDate = null): string {
        $resolved = $this->nullableString($primaryDate)
            ?? $this->nullableString($secondaryDate)
            ?? $this->nullableString($fallbackDate)
            ?? now()->toDateTimeString();

        return $resolved;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }
}
