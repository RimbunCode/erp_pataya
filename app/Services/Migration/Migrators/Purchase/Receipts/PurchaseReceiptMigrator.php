<?php

namespace App\Services\Migration\Migrators\Purchase\Receipts;

use App\FormStatus;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseReceiptMigrator extends BaseMigrator {
    protected string $sourceTable              = 'receive_orders';
    protected string $sourcePrimaryKey         = 'id';
    protected string $targetTable              = 'purchase_receipts';
    protected string $targetModel              = PurchaseReceipt::class;
    protected string $sourcePurchaseOrderTable = 'purch_orders';

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

                    $purchaseOrderId = $this->getNewId($this->sourcePurchaseOrderTable, $record->order_no ?? null);
                    $supplierId      = $this->getNewId('suppliers', $record->supplier_id ?? null);

                    $mappedData = [
                        'id'                => $newUlid,
                        'date'              => $this->resolveDateTime($record->receive_date, $record->created_at ?? null),
                        'return_against_id' => null,
                        'purchase_order_id' => $purchaseOrderId,
                        'supplier_id'       => $supplierId,
                        'external_note'     => $this->nullableString($record->comments),
                        'code'              => $this->buildCode($record),
                        'branch_id'         => $this->resolveBranchIdFromPurchaseOrder($purchaseOrderId),
                        'status'            => $this->mapLegacyStatus(null),
                        'created_by_id'     => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'      => null,
                        'canceled_at'       => null,
                        'revision_number'   => 0,
                        'amended_from_id'   => null,
                        'additional_data'   => [
                            'legacy_id'                => $legacyId,
                            'legacy_order_no'          => $record->order_no ?? null,
                            'legacy_reference'         => $record->reference ?? null,
                            'legacy_receive_reference' => $record->receive_reference ?? null,
                            'legacy_location'          => $record->location ?? null,
                            'legacy_receiver'          => $record->receiver ?? null,
                            'legacy_sender'            => $record->sender ?? null,
                        ],
                        'deleted_at' => null,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
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
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy receive_orders ke status ERP.
        return $this->defaultLegacyStatus();
    }

    protected function resolveBranchIdFromPurchaseOrder(?string $purchaseOrderId): ?string {
        if ($purchaseOrderId === null) {
            return $this->resolveDefaultBranchId();
        }

        $branchId = DB::table('purchase_orders')
            ->where('id', $purchaseOrderId)
            ->value('branch_id');

        return $branchId ? (string) $branchId : $this->resolveDefaultBranchId();
    }

    protected function buildCode(object $record): string {
        $receiveReference = $this->nullableString($record->receive_reference);
        if ($receiveReference !== null) {
            return $receiveReference;
        }

        $reference = $this->nullableString($record->reference);
        if ($reference !== null) {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->receive_date ?? null);

        return "RCV-{$legacyId}/{$year}";
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

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }
}

