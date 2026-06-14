<?php

namespace App\Services\Migration\Migrators\Core\Connections;

use App\Models\Core\ModelConnection;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Services\Migration\BaseMigrator;
use Illuminate\Support\Facades\DB;

class ModelConnectionMigrator extends BaseMigrator {
    protected string $sourceInternalOrderTable   = 'internal_orders';
    protected string $sourceSalesOrderTable      = 'sales_orders';
    protected string $sourcePurchaseOrderTable   = 'purch_orders';
    protected string $sourcePurchaseRequestTable = 'requisition';
    protected string $targetModel                = ModelConnection::class;

    public function migrate(): void {
        $this->log('Memulai migrasi koneksi dokumen ke model_connections');

        $this->migrateWorkOrderToInternalOrderConnections();
        $this->migrateWorkOrderToSalesOrderConnections();
        $this->migrateWorkOrderToPurchaseRequestConnections();
        $this->migratePurchaseRequestItemConnections();
        $this->migratePurchaseRequestToPurchaseOrderConnections();
        $this->migrateWorkOrderToPurchaseOrderConnections();
        $this->migrateSalesOrderToDeliveryNoteConnections();
        $this->migrateInternalOrderToDeliveryNoteConnections();
        $this->migratePurchaseOrderToPurchaseReceiptConnections();
        $this->migrateSalesOrderToSalesInvoiceConnections();
        $this->migrateReturnDocumentConnections();

        $this->log('Migrasi model_connections selesai.');
    }

    protected function migrateWorkOrderToInternalOrderConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourceInternalOrderTable),
            'work_order_to_internal_order',
            'id',
            function (object $record): void {
                $workOrderId     = $this->getNewId('breakdown', $record->breakdown_id ?? null);
                $internalOrderId = $this->getNewId($this->sourceInternalOrderTable, $record->id);

                $this->createConnection(
                    WorkOrder::class,
                    $workOrderId,
                    InternalOrder::class,
                    $internalOrderId,
                );
            },
        );
    }

    protected function migrateWorkOrderToSalesOrderConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourceSalesOrderTable),
            'work_order_to_sales_order',
            'order_no',
            function (object $record): void {
                $workOrderId  = $this->getNewId('breakdown', $record->breakdown_reference_id ?? null);
                $salesOrderId = $this->getNewId($this->sourceSalesOrderTable, $record->order_no);

                $this->createConnection(
                    WorkOrder::class,
                    $workOrderId,
                    SalesOrder::class,
                    $salesOrderId,
                );
            },
        );
    }

    protected function migrateWorkOrderToPurchaseRequestConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourcePurchaseRequestTable),
            'work_order_to_purchase_request',
            'id',
            function (object $record): void {
                $workOrderId       = $this->getNewId('breakdown', $record->breakdown_reference_id ?? null);
                $purchaseRequestId = $this->getNewId($this->sourcePurchaseRequestTable, $record->id);

                $this->createConnection(
                    WorkOrder::class,
                    $workOrderId,
                    PurchaseRequest::class,
                    $purchaseRequestId,
                );
            },
        );
    }

    protected function migratePurchaseRequestItemConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::table('purchase_request_items')
                ->whereNotNull('referenceable_type')
                ->whereNotNull('referenceable_id'),
            'purchase_request_item_connections',
            'id',
            function (object $record): void {
                $this->createConnection(
                    (string) $record->referenceable_type,
                    (string) $record->referenceable_id,
                    PurchaseRequestItem::class,
                    (string) $record->id,
                    ['requested_quantity' => (float) ($record->quantity ?? 0)],
                );
            },
        );
    }

    protected function migratePurchaseRequestToPurchaseOrderConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourcePurchaseOrderTable),
            'purchase_request_to_purchase_order',
            'order_no',
            function (object $record): void {
                $purchaseOrderId      = $this->getNewId($this->sourcePurchaseOrderTable, $record->order_no);
                $legacyRequisitionIds = array_merge(
                    $this->parseLegacyIdList($record->requisition_no ?? null),
                    $this->parseLegacyIdList($record->requisition_arr ?? null),
                );
                $legacyRequisitionIds = array_values(array_unique($legacyRequisitionIds));

                foreach ($legacyRequisitionIds as $legacyRequisitionId) {
                    $purchaseRequestId = $this->getNewId($this->sourcePurchaseRequestTable, $legacyRequisitionId);

                    $this->createConnection(
                        PurchaseRequest::class,
                        $purchaseRequestId,
                        PurchaseOrder::class,
                        $purchaseOrderId,
                    );
                }
            },
        );
    }

    protected function migrateWorkOrderToPurchaseOrderConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::connection($this->sourceConnection)->table($this->sourcePurchaseOrderTable),
            'work_order_to_purchase_order',
            'order_no',
            function (object $record): void {
                $purchaseOrderId    = $this->getNewId($this->sourcePurchaseOrderTable, $record->order_no);
                $legacyWorkOrderIds = $this->parseLegacyIdList($record->breakdown_arr ?? null);

                foreach ($legacyWorkOrderIds as $legacyWorkOrderId) {
                    $workOrderId = $this->getNewId('breakdown', $legacyWorkOrderId);

                    $this->createConnection(
                        WorkOrder::class,
                        $workOrderId,
                        PurchaseOrder::class,
                        $purchaseOrderId,
                    );
                }
            },
        );
    }

    protected function migrateSalesOrderToDeliveryNoteConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::table('delivery_notes')
                ->where('referenceable_type', SalesOrder::class)
                ->whereNotNull('referenceable_id'),
            'sales_order_to_delivery_note',
            'id',
            function (object $record): void {
                $this->createConnection(
                    SalesOrder::class,
                    (string) $record->referenceable_id,
                    DeliveryNote::class,
                    (string) $record->id,
                );
            },
        );
    }

    protected function migrateInternalOrderToDeliveryNoteConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::table('delivery_notes')
                ->where('referenceable_type', InternalOrder::class)
                ->whereNotNull('referenceable_id'),
            'internal_order_to_delivery_note',
            'id',
            function (object $record): void {
                $this->createConnection(
                    InternalOrder::class,
                    (string) $record->referenceable_id,
                    DeliveryNote::class,
                    (string) $record->id,
                );
            },
        );
    }

    protected function migratePurchaseOrderToPurchaseReceiptConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::table('purchase_receipts')
                ->whereNotNull('purchase_order_id'),
            'purchase_order_to_purchase_receipt',
            'id',
            function (object $record): void {
                $this->createConnection(
                    PurchaseOrder::class,
                    (string) $record->purchase_order_id,
                    PurchaseReceipt::class,
                    (string) $record->id,
                );
            },
        );
    }

    protected function migrateSalesOrderToSalesInvoiceConnections(): void {
        $this->processChunkedWithCheckpoint(
            DB::table('sales_invoices')
                ->whereNotNull('sales_order_id'),
            'sales_order_to_sales_invoice',
            'id',
            function (object $record): void {
                $this->createConnection(
                    SalesOrder::class,
                    (string) $record->sales_order_id,
                    SalesInvoice::class,
                    (string) $record->id,
                );
            },
        );
    }

    protected function migrateReturnDocumentConnections(): void {
        $this->createReturnConnections('delivery_notes', DeliveryNote::class);
        $this->createReturnConnections('purchase_receipts', PurchaseReceipt::class);
        $this->createReturnConnections('sales_invoices', SalesInvoice::class);
    }

    protected function createReturnConnections(string $table, string $modelClass): void {
        $checkpointKey = "return_connection_{$table}";

        $this->processChunkedWithCheckpoint(
            DB::table($table)->whereNotNull('return_against_id'),
            $checkpointKey,
            'id',
            function (object $record) use ($modelClass): void {
                $this->createConnection(
                    $modelClass,
                    (string) $record->return_against_id,
                    $modelClass,
                    (string) $record->id,
                    ['connection_type' => 'return_against'],
                );
            },
        );
    }

    protected function createConnection(
        string $modelType,
        ?string $modelId,
        string $referenceType,
        ?string $referenceId,
        ?array $data = null,
    ): void {
        if ($modelId === null || $modelId === '' || $referenceId === null || $referenceId === '') {
            return;
        }

        ModelConnection::createConnection([
            'model_type'     => $modelType,
            'model_id'       => $modelId,
            'reference_type' => $referenceType,
            'reference_id'   => $referenceId,
            'data'           => $data,
        ]);
    }

    /**
     * @return array<int, string>
     */
    protected function parseLegacyIdList(mixed $value): array {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return [];
        }

        preg_match_all('/\d+/', $raw, $matches);
        $ids = $matches[0] ?? [];

        return array_values(array_unique(array_filter(array_map(
            static fn ($id): string => (string) (int) $id,
            $ids,
        ))));
    }
}

