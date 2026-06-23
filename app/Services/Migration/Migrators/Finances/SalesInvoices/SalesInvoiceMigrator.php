<?php

namespace App\Services\Migration\Migrators\Finances\SalesInvoices;

use App\Enums\FormStatus;
use App\Models\Finances\SalesInvoice;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesInvoiceMigrator extends BaseMigrator {
    protected string $sourceTable           = 'sales_orders';
    protected string $mappingSourceTable    = 'sales_orders.invoice';
    protected string $sourcePrimaryKey      = 'order_no';
    protected string $targetTable           = 'sales_invoices';
    protected string $targetModel           = SalesInvoice::class;
    protected string $sourceSalesOrderTable = 'sales_orders';

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyOrderNo = $record->{$this->sourcePrimaryKey};
                    $existingId    = $this->getNewId($this->mappingSourceTable, $legacyOrderNo);
                    $newUlid       = $existingId ?? (string) Str::ulid();

                    $salesOrderId = $this->getNewId($this->sourceSalesOrderTable, $legacyOrderNo);
                    $customerId   = $this->getNewId('debtors_master', $record->debtor_no ?? null);
                    $salesOrder   = $salesOrderId ? $this->resolveSalesOrderContext($salesOrderId) : [];

                    $mappedData = [
                        'id'                   => $newUlid,
                        'date'                 => $this->resolveDateTime($record->ord_date, $record->created_at ?? null),
                        'return_against_id'    => null,
                        'debit_account_id'     => null,
                        'income_account_id'    => null,
                        'customer_id'          => $customerId,
                        'customer_name'        => $this->resolveCustomerName($customerId),
                        'customer_branch_id'   => $salesOrder['customer_branch_id'] ?? null,
                        'customer_branch_name' => $salesOrder['customer_branch_name'] ?? null,
                        'sales_order_id'       => $salesOrderId,
                        'amount'               => max((float) ($record->total ?? 0), 0),
                        'paid_amount'          => max((float) ($record->paid_amount ?? 0), 0),
                        'discount_on'          => null,
                        'discount_rate'        => 0,
                        'discount_amount'      => max((float) ($record->discount ?? 0), 0),
                        'currency_code'        => null,
                        'base_currency_code'   => null,
                        'exchange_rate'        => null,
                        'external_note'        => $this->nullableString($record->comments),
                        'code'                 => $this->ensureUniqueCode($this->buildCode($record), $newUlid, (string) $legacyOrderNo),
                        'branch_id'            => $salesOrder['branch_id'] ?? $this->resolveDefaultBranchId(),
                        'status'               => $this->mapLegacyStatus($record),
                        'created_by_id'        => $this->resolveCreatedById($record->person_id ?? null),
                        'submitted_at'         => null,
                        'canceled_at'          => null,
                        'revision_number'      => 0,
                        'amended_from_id'      => null,
                        'additional_data'      => [
                            'legacy_source_table' => $this->sourceTable,
                            'legacy_order_no'     => $legacyOrderNo,
                            'legacy_reference'    => $record->reference ?? null,
                            'legacy_order_type'   => $record->order_type ?? null,
                            'legacy_inv_type'     => $record->inv_type ?? null,
                            'legacy_choices'      => $record->choices ?? null,
                            'legacy_trans_type'   => $record->trans_type ?? null,
                        ],
                        'deleted_at' => $record->deleted_at,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->mappingSourceTable, $legacyOrderNo, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->targetTable} selesai.");
    }

    /**
     * @return array<int, FormStatus>
     */
    protected function mapLegacyStatus(object $record): array {
        // TODO: sesuaikan mapping status legacy sales_orders (invoice side) ke status ERP.
        return $this->defaultLegacyStatus();
    }

    /**
     * @return array{customer_branch_id: ?string, customer_branch_name: ?string, branch_id: ?string}
     */
    protected function resolveSalesOrderContext(string $salesOrderId): array {
        $record = DB::table('sales_orders')
            ->select(['customer_branch_id', 'customer_branch_name', 'branch_id'])
            ->where('id', $salesOrderId)
            ->first();

        if ($record === null) {
            return [
                'customer_branch_id'   => null,
                'customer_branch_name' => null,
                'branch_id'            => $this->resolveDefaultBranchId(),
            ];
        }

        return [
            'customer_branch_id'   => $record->customer_branch_id ? (string) $record->customer_branch_id : null,
            'customer_branch_name' => $record->customer_branch_name ? (string) $record->customer_branch_name : null,
            'branch_id'            => $record->branch_id ? (string) $record->branch_id : $this->resolveDefaultBranchId(),
        ];
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

        $legacyOrderNo = (string) $record->{$this->sourcePrimaryKey};
        $year          = $this->extractShortYear($record->created_at ?? $record->ord_date ?? null);

        return "INV-{$legacyOrderNo}/{$year}";
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
