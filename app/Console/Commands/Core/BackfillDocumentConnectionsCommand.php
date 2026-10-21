<?php

namespace App\Console\Commands\Core;

use App\Events\Core\DocumentSubmitted;
use App\Listeners\Core\Submission\CreateDocumentConnection;
use App\Models\Core\ModelConnection;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\StockEntry;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\Service\WorkOrderItem;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Spec document-connection-coverage, FR4: mengisi model_connections untuk dokumen lama
 * yang sudah disubmit sebelum pencatatan koneksi dipasang. Memakai jalur yang sama
 * dengan submit (attachConnections() dan CreateDocumentConnection), sehingga bentuk
 * barisnya identik. ModelConnection::createConnection() memakai updateOrCreate, jadi
 * command ini aman dijalankan ulang.
 */
class BackfillDocumentConnectionsCommand extends Command {
    private const CHUNK_SIZE = 500;

    protected $signature   = 'connections:backfill {--dry-run : Hitung dan laporkan tanpa menulis ke database}';
    protected $description = 'Catat koneksi dokumen lama yang belum ada di model_connections';

    /** @var array<string, int> */
    private array $created = [];

    public function handle(): int {
        $dryRun        = (bool) $this->option('dry-run');
        $this->created = [];

        Event::listen('eloquent.created: ' . ModelConnection::class, function (ModelConnection $connection): void {
            $key                 = class_basename($connection->model_type) . ' -> ' . class_basename($connection->reference_type);
            $this->created[$key] = ($this->created[$key] ?? 0) + 1;
        });

        if ($dryRun) {
            DB::beginTransaction();
        }

        try {
            $this->backfillItems();
            $this->backfillHeaderLinks();
            $this->backfillReturns();
        } finally {
            if ($dryRun) {
                DB::rollBack();
            }

            Event::forget('eloquent.created: ' . ModelConnection::class);
        }

        $this->printSummary($dryRun);

        return self::SUCCESS;
    }

    /**
     * Baris item ber-referenceable: sama dengan attachConnections() yang dipanggil submit.
     * Payload PO mengikuti PurchaseOrderService::onApproved(), jenis lain tanpa payload.
     */
    private function backfillItems(): void {
        foreach ($this->itemClasses() as $itemClass) {
            $parentRelation = $itemClass::$parentRelation;

            $itemClass::query()
                ->whereNotNull('referenceable_type')
                ->whereNotNull('referenceable_id')
                ->with(['referenceable', $parentRelation])
                ->chunkById(self::CHUNK_SIZE, function (Collection $items) use ($parentRelation): void {
                    foreach ($items as $item) {
                        $document = $item->{$parentRelation};
                        if ($document === null || ! method_exists($document, 'attachConnections')) {
                            continue;
                        }

                        // Hanya mengisi yang belum ada (FR5): baris yang sudah tercatat saat submit
                        // tidak di-update, supaya payload data-nya tidak tertimpa.
                        if ($this->connectionExists($item->referenceable, $item)) {
                            continue;
                        }

                        $document->attachConnections($item, $this->itemPayload($item));
                    }
                });
        }
    }

    /**
     * Induk langsung dari kolom header. Memakai listener yang sama dengan submit,
     * jadi rantai di atas induk ikut terbentuk bila induk punya referenceable.
     */
    private function backfillHeaderLinks(): void {
        $listener = app(CreateDocumentConnection::class);

        foreach ($this->headerLinks() as [$documentClass, $relation, $column]) {
            $documentClass::query()
                ->whereNotNull($column)
                ->with($relation)
                ->chunkById(self::CHUNK_SIZE, function (Collection $documents) use ($listener, $relation): void {
                    foreach ($documents as $document) {
                        $parent = $document->{$relation};
                        if ($parent === null || $this->connectionExists($parent, $document)) {
                            continue;
                        }

                        $listener->handle(new DocumentSubmitted($document, $parent));
                    }
                });
        }
    }

    /**
     * Retur hanya tercatat lewat foreign key. Tautan ke dokumen asal ditulis di sini,
     * sama dengan yang dilakukan submit retur (FR3).
     */
    private function backfillReturns(): void {
        foreach ([PurchaseReceipt::class, DeliveryNote::class] as $documentClass) {
            $documentClass::query()
                ->whereNotNull('return_against_id')
                ->with('returnAgainst')
                ->chunkById(self::CHUNK_SIZE, function (Collection $documents): void {
                    foreach ($documents as $document) {
                        $returnAgainst = $document->returnAgainst;
                        if ($returnAgainst === null || $this->connectionExists($returnAgainst, $document)) {
                            continue;
                        }

                        ModelConnection::createConnection([
                            'model'     => $returnAgainst,
                            'reference' => $document,
                        ]);
                    }
                });
        }
    }

    /**
     * Baris tingkat pertama (model -> reference) sudah ada, berarti rantainya tercatat saat submit.
     */
    private function connectionExists(?BaseModel $model, BaseModel $reference): bool {
        if ($model === null) {
            return false;
        }

        return ModelConnection::query()
            ->where('model_type', $model::class)
            ->where('model_id', $model->getKey())
            ->where('reference_type', $reference::class)
            ->where('reference_id', $reference->getKey())
            ->exists();
    }

    /**
     * @return array<int, class-string>
     */
    private function itemClasses(): array {
        return [
            WorkOrderItem::class,
            InternalOrderItem::class,
            PurchaseOrderItem::class,
            PurchaseRequestItem::class,
            PurchaseInvoiceItem::class,
            DeliveryNoteItem::class,
            SalesOrderItem::class,
        ];
    }

    /**
     * @return array<int, array{0: class-string, 1: string, 2: string}>
     */
    private function headerLinks(): array {
        return [
            [PurchaseReceipt::class, 'purchaseOrder', 'purchase_order_id'],
            [PurchaseInvoice::class, 'purchaseOrder', 'purchase_order_id'],
            [SalesInvoice::class, 'salesOrder', 'sales_order_id'],
            [DeliveryNote::class, 'referenceable', 'referenceable_type'],
            [SalesOrder::class, 'referenceable', 'referenceable_type'],
            [StockEntry::class, 'referenceable', 'referenceable_type'],
            [PaymentEntry::class, 'paymentable', 'paymentable_type'],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function itemPayload(object $item): ?array {
        return $item instanceof PurchaseOrderItem
            ? ['ordered_quantity' => $item->quantity]
            : null;
    }

    private function printSummary(bool $dryRun): void {
        $rows = collect($this->created)
            ->sortKeys()
            ->map(fn (int $count, string $pair): array => [$pair, $count])
            ->values()
            ->all();

        if ($rows === []) {
            $this->info('Tidak ada koneksi baru yang perlu ditulis.');
        } else {
            $this->table(['Pasangan (model -> reference)', 'Baris ditulis'], $rows);
        }

        $total = array_sum($this->created);
        $this->line($dryRun
            ? "[DRY RUN] {$total} baris akan ditulis. Tidak ada yang disimpan."
            : "{$total} baris ditulis.");
    }
}
