<?php

namespace App\Services\Migration\Migrators\Service\WorkOrders;

use App\FormStatus;
use App\Models\Service\WorkOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkOrderMigrator extends BaseMigrator {
    protected string $sourceTable      = 'breakdown';
    protected string $sourcePrimaryKey = 'breakdown_no';
    protected string $targetTable      = 'work_orders';
    protected string $targetModel      = WorkOrder::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $customerId = $this->getNewId('debtors_master', $record->debtor_id ?? null);
                    $status     = $this->mapLegacyStatus($record->status ?? null);
                    $code       = $this->buildCode($record);

                    $mappedData = [
                        'id'                   => $newUlid,
                        'customer_id'          => $customerId,
                        'customer_name'        => $this->resolveCustomerName($customerId),
                        'customer_branch_id'   => null,
                        'customer_branch_name' => null,
                        'item_service_id'      => null,
                        'item_service_name'    => $this->nullableString($record->stock_id),
                        'date'                 => $this->normalizeDateTime($record->date_off),
                        'external_note'        => $this->nullableString($record->comments),
                        'started_at'           => $this->normalizeDateTime($record->date_off),
                        'completed_at'         => $this->normalizeDateTime($record->date_on),
                        'code'                 => $code,
                        'branch_id'            => $this->resolveDefaultBranchId(),
                        'status'               => $status,
                        'created_by_id'        => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'         => null,
                        'canceled_at'          => null,
                        'revision_number'      => (int) ($record->revision ?? 0),
                        'amended_from_id'      => null,
                        'additional_data'      => [
                            'legacy_id'        => $record->{$this->sourcePrimaryKey},
                            'legacy_reference' => $record->reference ?? null,
                            'legacy_type'      => $record->type ?? null,
                            'legacy_status'    => $record->status ?? null,
                        ],
                        'deleted_at' => $record->deleted_at,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
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

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy breakdown ke status ERP.
        return $this->defaultLegacyStatus();
    }

    protected function resolveCustomerName(?string $customerId): ?string {
        if ($customerId === null) {
            return null;
        }

        $name = DB::table('customers')->where('id', $customerId)->value('name');

        return $name ? (string) $name : null;
    }

    protected function buildCode(object $record): string {
        $reference = $this->nullableString($record->reference);
        if ($reference !== null) {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->date_off ?? null);

        return "WO-{$legacyId}/{$year}";
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }

    protected function normalizeDateTime(mixed $value): ?string {
        $normalized = $this->nullableString($value);

        return $normalized;
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }
}

