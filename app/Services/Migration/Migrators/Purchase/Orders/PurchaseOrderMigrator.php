<?php

namespace App\Services\Migration\Migrators\Purchase\Orders;

use App\Enums\FormStatus;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseOrderMigrator extends BaseMigrator {
    protected string $sourceTable      = 'purch_orders';
    protected string $sourcePrimaryKey = 'order_no';
    protected string $targetTable      = 'purchase_orders';
    protected string $targetModel      = PurchaseOrder::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $supplierId = $this->getNewId('suppliers', $record->supplier_id ?? null);

                    $mappedData = [
                        'id'                   => $newUlid,
                        'date'                 => $record->ord_date,
                        'required_date'        => $record->inv_receive_date,
                        'supplier_id'          => $supplierId,
                        'supplier_name'        => $this->resolveSupplierName($supplierId),
                        'currency_code'        => null,
                        'exchange_rate'        => $this->normalizeExchangeRate($record->kurs ?? null),
                        'base_currency_code'   => null,
                        'amount'               => (float) ($record->total ?? 0),
                        'amount_base_currency' => (float) ($record->total ?? 0),
                        'discount_on'          => null,
                        'discount_rate'        => 0,
                        'discount_amount'      => (float) ($record->discount ?? 0),
                        'external_note'        => $this->nullableString($record->comments),
                        'code'                 => $this->buildCode($record),
                        'branch_id'            => $this->resolveDefaultBranchId(),
                        'status'               => $this->mapLegacyStatus($record->status ?? null),
                        'created_by_id'        => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'         => null,
                        'canceled_at'          => null,
                        'revision_number'      => (int) ($record->revision ?? 0),
                        'amended_from_id'      => null,
                        'additional_data'      => [
                            'legacy_id'         => $record->{$this->sourcePrimaryKey},
                            'legacy_reference'  => $record->reference ?? null,
                            'legacy_status'     => $record->status ?? null,
                            'legacy_inv_number' => $record->inv_number ?? null,
                        ],
                        'deleted_at'           => $record->deleted_at,
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

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(mixed $legacyStatus): array {
        // TODO: sesuaikan mapping status legacy purchase order ke status ERP.
        return $this->defaultLegacyStatus();
    }

    protected function resolveSupplierName(?string $supplierId): ?string {
        if ($supplierId === null) {
            return null;
        }

        $name = DB::table('suppliers')->where('id', $supplierId)->value('name');

        return $name ? (string) $name : null;
    }

    protected function buildCode(object $record): string {
        $reference = trim((string) ($record->reference ?? ''));
        if ($reference !== '') {
            return $reference;
        }

        $legacyId = (string) $record->{$this->sourcePrimaryKey};
        $year     = $this->extractShortYear($record->created_at ?? $record->ord_date ?? null);

        return "PO-{$legacyId}/{$year}";
    }

    protected function extractShortYear(mixed $date): string {
        $timestamp = strtotime((string) ($date ?? ''));

        return $timestamp ? date('y', $timestamp) : date('y');
    }

    protected function normalizeExchangeRate(mixed $value): ?float {
        $rate = (float) ($value ?? 0);

        return $rate > 0 ? $rate : null;
    }

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}
