<?php

namespace App\Services\Migration\Migrators\Sales\Orders;

use App\FormStatus;
use App\Models\Sales\SalesOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesOrderMigrator extends BaseMigrator {
    protected string $sourceTable      = 'sales_orders';
    protected string $sourcePrimaryKey = 'order_no';
    protected string $targetTable      = 'sales_orders';
    protected string $targetModel      = SalesOrder::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();

                    $customerId = $this->getNewId('debtors_master', $record->debtor_no ?? null);
                    $code       = $this->buildCode($record);

                    $mappedData = [
                        'id'                   => $newUlid,
                        'referenceable_type'   => null,
                        'referenceable_id'     => null,
                        'customer_id'          => $customerId,
                        'customer_name'        => $this->resolveCustomerName($customerId),
                        'customer_branch_id'   => null,
                        'customer_branch_name' => null,
                        'reference_so_id'      => null,
                        'is_rent'              => false,
                        'date'                 => $record->ord_date,
                        'start_date'           => $record->start_date,
                        'end_date'             => $record->end_date,
                        'external_note'        => $this->nullableString($record->comments),
                        'currency_code'        => null,
                        'base_currency_code'   => null,
                        'exchange_rate'        => null,
                        'discount_amount'      => (float) ($record->discount ?? 0),
                        'discount_rate'        => 0,
                        'discount_on'          => null,
                        'amount'               => (float) ($record->total ?? 0),
                        'code'                 => $code,
                        'branch_id'            => $this->resolveDefaultBranchId(),
                        'status'               => $this->mapLegacyStatus($record),
                        'created_by_id'        => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'         => null,
                        'canceled_at'          => null,
                        'revision_number'      => 0,
                        'amended_from_id'      => null,
                        'additional_data'      => [
                            'legacy_id'           => $record->{$this->sourcePrimaryKey},
                            'legacy_reference'    => $record->reference ?? null,
                            'legacy_order_type'   => $record->order_type ?? null,
                            'legacy_inv_type'     => $record->inv_type ?? null,
                            'legacy_breakdown_id' => $record->breakdown_reference_id ?? null,
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
    protected function mapLegacyStatus(object $record): array {
        // TODO: sesuaikan mapping status/choices legacy sales order ke status ERP.
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
        $reference = trim((string) ($record->reference ?? ''));
        if ($reference !== '') {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->ord_date ?? null);

        return "SO-{$legacyId}/{$year}";
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

