<?php

namespace App\Services\Migration\Migrators\Sales\Orders;

use App\Models\Sales\SalesOrderItem;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesOrderItemMigrator extends BaseMigrator {
    protected string $sourceTable        = 'sales_order_details';
    protected string $sourcePrimaryKey   = 'id';
    protected string $sourceStockCodeKey = 'item_code.stock_id';
    protected string $targetTable        = 'sales_order_items';
    protected string $targetModel        = SalesOrderItem::class;

    public function migrate(): void {
        $this->log("Memulai migrasi {$this->sourceTable} -> {$this->targetTable}");

        DB::connection($this->sourceConnection)
            ->table($this->sourceTable)
            ->orderBy($this->sourcePrimaryKey)
            ->chunk(500, function ($records): void {
                foreach ($records as $record) {
                    $salesOrderId = $this->getNewId('sales_orders', $record->order_no ?? null);
                    if ($salesOrderId === null) {
                        $this->log("Lewati detail SO {$record->{$this->sourcePrimaryKey}} karena sales_order belum termigrasi.", 'warning');

                        continue;
                    }

                    $itemVariantId = $this->getNewId($this->sourceStockCodeKey, $record->stock_id ?? null);
                    if ($itemVariantId === null) {
                        $this->log("Lewati detail SO {$record->{$this->sourcePrimaryKey}} karena item {$record->stock_id} belum termigrasi.", 'warning');

                        continue;
                    }

                    $existingId = $this->getNewId($this->sourceTable, $record->{$this->sourcePrimaryKey});
                    $newUlid    = $existingId ?? (string) Str::ulid();
                    $unitId     = $this->resolveDefaultUnitId($itemVariantId);

                    $mappedData = [
                        'id'                  => $newUlid,
                        'sales_order_id'      => $salesOrderId,
                        'item_id'             => $itemVariantId,
                        'unit_id'             => $unitId,
                        'referenceable_type'  => null,
                        'referenceable_id'    => null,
                        'source_warehouse_id' => null,
                        'quantity'            => (float) ($record->quantity ?? 0),
                        'delivered_quantity'  => (float) ($record->qty_sent ?? 0),
                        'billed_quantity'     => 0,
                        'description'         => $this->nullableString($record->description),
                        'tax_id'              => null,
                        'conversion_factor'   => 1,
                        'tax_rate'            => 0,
                        'currency_code'       => null,
                        'base_currency_code'  => null,
                        'exchange_rate'       => null,
                        'price'               => (float) ($record->unit_price ?? 0),
                        'created_at'          => $record->created_at,
                        'updated_at'          => $record->updated_at,
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

    protected function nullableString(mixed $value): ?string {
        $stringValue = trim((string) ($value ?? ''));

        return $stringValue === '' ? null : $stringValue;
    }
}

