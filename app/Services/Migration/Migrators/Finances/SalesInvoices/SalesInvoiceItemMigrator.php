<?php

namespace App\Services\Migration\Migrators\Finances\SalesInvoices;

use App\Models\Finances\SalesInvoiceItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesInvoiceItemMigrator extends BaseMigrator {
    protected string $sourceTable               = 'sales_order_details';
    protected string $mappingSourceTable        = 'sales_order_details.invoice';
    protected string $sourcePrimaryKey          = 'id';
    protected string $sourceStockCodeKey        = 'item_code.stock_id';
    protected string $sourceInvoiceMapTable     = 'sales_orders.invoice';
    protected string $sourceSalesOrderTable     = 'sales_orders';
    protected string $targetTable               = 'sales_invoice_items';
    protected string $targetModel               = SalesInvoiceItem::class;
    protected string $targetSalesOrderItemTable = 'sales_order_items';

    /**
     * @var array<string, array{currency_code: ?string, base_currency_code: ?string, exchange_rate: ?float}>
     */
    protected array $invoiceContextCache = [];

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $legacyDetailId = $record->{$this->sourcePrimaryKey};
                    $salesInvoiceId = $this->getNewId($this->sourceInvoiceMapTable, $record->order_no ?? null);
                    if ($salesInvoiceId === null) {
                        $this->log("Lewati sales invoice detail {$legacyDetailId} karena sales_invoice belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati sales invoice detail {$legacyDetailId} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $unitId = $this->resolveDefaultUnitId($itemVariantId);
                    if ($unitId === null) {
                        $this->log("Lewati sales invoice detail {$legacyDetailId} karena unit default item tidak ditemukan.", 'warning');

                        continue;
                    }

                    $existingId       = $this->getNewId($this->mappingSourceTable, $legacyDetailId);
                    $newUlid          = $existingId ?? (string) Str::ulid();
                    $invoiceContext   = $this->resolveInvoiceContext($salesInvoiceId);
                    $salesOrderItemId = $this->resolveSalesOrderItemId($record->order_no ?? null, $itemVariantId);

                    $price        = max((float) ($record->unit_price ?? 0), 0);
                    $exchangeRate = $invoiceContext['exchange_rate'];

                    $mappedData = [
                        'id'                     => $newUlid,
                        'sales_invoice_id'       => $salesInvoiceId,
                        'sales_order_item_id'    => $salesOrderItemId,
                        'return_against_item_id' => null,
                        'item_id'                => $itemVariantId,
                        'unit_id'                => $unitId,
                        'quantity'               => max((float) ($record->quantity ?? 0), 0),
                        'returned_quantity'      => max((float) ($record->qty_retur ?? 0), 0),
                        'price'                  => $price,
                        'price_base_currency'    => $exchangeRate ? $price * $exchangeRate : $price,
                        'description'            => $this->nullableString($record->description),
                        'tax_id'                 => null,
                        'conversion_factor'      => 1,
                        'tax_rate'               => 0,
                        'currency_code'          => $invoiceContext['currency_code'],
                        'base_currency_code'     => $invoiceContext['base_currency_code'],
                        'exchange_rate'          => $invoiceContext['exchange_rate'],
                        'deleted_at'             => null,
                        'created_at'             => $record->created_at,
                        'updated_at'             => $record->updated_at,
                    ];

                    DB::table($this->targetTable)->updateOrInsert(
                        ['id' => $newUlid],
                        $mappedData,
                    );

                    $this->mapId($this->mappingSourceTable, $legacyDetailId, $newUlid);
                    $this->recordModelLog($this->targetModel, $newUlid, $mappedData);
                }
            });

        $this->log("Migrasi {$this->targetTable} selesai.");
    }

    /**
     * @return array{currency_code: ?string, base_currency_code: ?string, exchange_rate: ?float}
     */
    protected function resolveInvoiceContext(string $salesInvoiceId): array {
        if (array_key_exists($salesInvoiceId, $this->invoiceContextCache)) {
            return $this->invoiceContextCache[$salesInvoiceId];
        }

        $invoice = DB::table('sales_invoices')
            ->select(['currency_code', 'base_currency_code', 'exchange_rate'])
            ->where('id', $salesInvoiceId)
            ->first();

        $context = [
            'currency_code'      => $invoice?->currency_code ? (string) $invoice->currency_code : null,
            'base_currency_code' => $invoice?->base_currency_code ? (string) $invoice->base_currency_code : null,
            'exchange_rate'      => $invoice?->exchange_rate !== null ? (float) $invoice->exchange_rate : null,
        ];

        $this->invoiceContextCache[$salesInvoiceId] = $context;

        return $context;
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

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

