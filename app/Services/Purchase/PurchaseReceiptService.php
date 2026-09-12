<?php

namespace App\Services\Purchase;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Core\DocumentSubmitted;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Core\ModelConnection;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class PurchaseReceiptService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['return_against_id'] = $data['return_against']['id'] ?? null;

        return $data;
    }

    private function fillItemRelations(array $data, array $units = [], array $purchaseOrderItems = []) {
        $unit                        = $units[$data['unit']['id']] ?? null;
        $data['item_id']             = $purchaseOrderItems[$data['purchase_order_item_id']]->item_id;
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $data['target_warehouse_id'] = $data['target_warehouse']['id'] ?? '';

        return $data;
    }

    private function batchLoadPurchaseOrderItems(array $data): array {
        $ids = collect($data['items'])->pluck('purchase_order_item_id')->filter()->unique()->values();

        return PurchaseOrderItem::whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data): Model {
        $data['code']       = FormatingSeries::generate(PurchaseReceipt::class, $data, true);
        $purchaseReceipt    = PurchaseReceipt::create($this->fillRelations($data));
        $units              = $this->batchLoadUnits($data);
        $purchaseOrderItems = $this->batchLoadPurchaseOrderItems($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units, $purchaseOrderItems);
            $purchaseReceipt->items()->create($item);
        }

        return $purchaseReceipt;
    }

    public function update(Model $purchaseReceipt, array $data): Model {
        $purchaseReceipt->fillForUpdate($this->fillRelations($data));

        $purchaseReceipt->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseReceipt->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');
        $units              = $this->batchLoadUnits($data);
        $purchaseOrderItems = $this->batchLoadPurchaseOrderItems($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units, $purchaseOrderItems);

            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

                continue;
            }

            $purchaseReceipt->items()->create($item);
        }

        return $purchaseReceipt;
    }

    public function submit(Model $purchaseReceipt): mixed {
        DB::beginTransaction();

        $purchaseReceipt->update([
            'code' => FormatingSeries::generate(PurchaseReceipt::class, $purchaseReceipt),
        ]);
        event(new DocumentSubmitted($purchaseReceipt, $purchaseReceipt->purchaseOrder));
        DB::commit();
        $purchaseReceipt->checkApproval();

        return $purchaseReceipt;
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    public function onApproved(Model $purchaseReceipt): mixed {
        DB::beginTransaction();
        $returnAgainst = $purchaseReceipt->returnAgainst;
        $purchaseReceipt->update([
            'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::RECEIVED,
        ]);

        $purchaseOrder = $purchaseReceipt->purchaseOrder;

        $items = $purchaseReceipt->items()
            ->with([
                'item',
                'item.item',
                'item.defaultUom',
                'purchaseOrderItem',
                'targetWarehouse',
                'returnAgainstItem',
            ])->get();

        // Guard: defaultUom (ItemVariant::defaultUom(), hasOne via join ke ItemUnit
        // yg unit_id-nya cocok default_unit_id) bisa null -- default_unit_id nullable,
        // atau ItemUnit konversi utk unit itu belum didaftarkan. Validasi di sini
        // (sebelum item dipakai di 2 loop bawah) supaya gagal jelas via error bag,
        // bukan ErrorException null property access di tengah proses approve.
        $missingDefaultUomItems = [];
        foreach ($items as $item) {
            if (! $item->item->defaultUom) {
                $missingDefaultUomItems[] = "Item {$item->item->code} tidak memiliki unit konversi default (defaultUom) terdaftar.";
            }
        }
        if (\count($missingDefaultUomItems) > 0) {
            DB::rollBack();
            throw ValidationException::withMessages([
                'items' => $missingDefaultUomItems,
            ]);
        }

        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('target_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
        $missingStocks = [];
        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->target_warehouse_id}";
            if ($stocks->has($stockKey) || isset($missingStocks[$stockKey])) {
                continue;
            }

            $defaultUom               = $item->item->defaultUom;
            $missingStocks[$stockKey] = [
                'item_variant_id'   => $item->item_id,
                'warehouse_id'      => $item->target_warehouse_id,
                'conversion_factor' => $defaultUom->conversion_factor,
                'item_unit_id'      => $defaultUom->id,
                'stock_queue'       => [],
            ];
        }

        foreach ($missingStocks as $stockKey => $missingStock) {
            $stock = Stock::lockForUpdate()->firstOrCreate([
                'item_variant_id' => $missingStock['item_variant_id'],
                'warehouse_id'    => $missingStock['warehouse_id'],
            ], [
                'conversion_factor' => $missingStock['conversion_factor'],
                'item_unit_id'      => $missingStock['item_unit_id'],
                'stock_queue'       => $missingStock['stock_queue'],
            ]);

            $stocks->put($stockKey, $stock);
        }

        // Total nilai untuk GL (hanya ALUR-2 yang mengisi ini)
        $totalRatesForGL = 0;

        foreach ($items as $item) {
            $defaultUom              = $item->item->defaultUom;
            $defaultConvertionFactor = $defaultUom->conversion_factor;
            $stockKey                = "{$item->item_id}-{$item->target_warehouse_id}";
            $stock                   = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $queue    = $stock->stock_queue;
            $poItem   = $item->purchaseOrderItem;

            // === RETURN HANDLING ===
            if ($returnAgainst) {
                $totalRate = $poItem->rate * $quantity;

                for ($i = \count($queue) - 1; $i >= 0; $i--) {
                    if ($queue[$i]['rate'] == $poItem->rate) {
                        $queue[$i]['quantity'] -= $quantity;
                        break;
                    }
                }

                $stock->update([
                    'stock_queue' => $queue,
                    'quantity'    => $stock->quantity - $quantity,
                ]);
                $stock->updateDetails('increment', 'incomings', $purchaseOrder->code, $quantity);
                // Lock returnAgainstItem sebelum baca-modifikasi-tulis (Req 1.3)
                $returnAgainstItem = $item->returnAgainstItem()->lockForUpdate()->first();
                $returnAgainstItem->increment('returned_quantity', $quantity);
                $poItem->decrement('received_quantity', $quantity);
                $stock->refresh();

                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->target_warehouse_id,
                    'item_unit_id'               => $defaultUom->id,
                    'conversion_factor'          => $defaultConvertionFactor,
                    'quantity_change'            => -$quantity,
                    'quantity_after_transaction' => $stock->actual_quantity,
                    'valuation_rate'             => $stock->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                    'change_in_stock_value'      => -$totalRate,
                    'stock_queue'                => $stock->stock_queue,
                    'referenceable_type'         => PurchaseReceipt::class,
                    'referenceable_id'           => $purchaseReceipt->id,
                    'is_valuated'                => true,
                    'transaction_date'           => now(),
                ]);

                continue;
            }

            // === DUAL FLOW: cek apakah Invoice sudah ada duluan ===
            // Lock PO Item untuk mencegah race condition pada billed_quantity (Req 1.1)
            $poItem          = PurchaseOrderItem::where('id', $poItem->id)->lockForUpdate()->first();
            $isAlreadyBilled = $poItem->billed_quantity > 0;

            if ($isAlreadyBilled) {
                // === ALUR-2: Invoice approve duluan → Receipt kemudian ===
                $invoiceItems = $this->findInvoiceItemsForPoItem($poItem, $purchaseOrder);
                $remainingQty = $quantity;

                foreach ($invoiceItems as $invoiceItem) {
                    if ($remainingQty <= 0) {
                        break;
                    }

                    $rate         = $invoiceItem->rate;
                    $availableQty = $invoiceItem->quantity - $invoiceItem->allocated_qty;
                    if ($availableQty <= 0) {
                        continue;
                    }

                    $allocateQty = min($remainingQty, $availableQty);

                    // 1. Update Stock queue dulu (sle_id null sementara)
                    $queue[] = [
                        'rate'            => $rate,
                        'quantity'        => $allocateQty,
                        'is_valuated'     => true,
                        'sle_id'          => null,
                        'receipt_item_id' => $item->id,
                    ];
                    $stock->update([
                        'stock_queue' => $queue,
                        'quantity'    => $stock->quantity + $allocateQty,
                    ]);
                    $stock->refresh();

                    // 2. Buat SLE dengan data Stock yang sudah final
                    $sle = StockLedgerEntry::create([
                        'item_id'                    => $item->item_id,
                        'warehouse_id'               => $item->target_warehouse_id,
                        'item_unit_id'               => $defaultUom->id,
                        'conversion_factor'          => $defaultConvertionFactor,
                        'quantity_change'            => $allocateQty,
                        'quantity_after_transaction' => $stock->actual_quantity,
                        'valuation_rate'             => $rate,
                        'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                        'change_in_stock_value'      => $rate * $allocateQty,
                        'stock_queue'                => $stock->stock_queue,
                        'referenceable_type'         => PurchaseReceipt::class,
                        'referenceable_id'           => $purchaseReceipt->id,
                        'is_valuated'                => true,
                        'transaction_date'           => now(),
                    ]);

                    // 3. Patch queue entry terakhir dengan sle_id
                    $queue[array_key_last($queue)]['sle_id'] = $sle->id;
                    $stock->update(['stock_queue' => $queue]);

                    $invoiceItem->increment('allocated_qty', $allocateQty);
                    $totalRatesForGL += $rate * $allocateQty;
                    $remainingQty -= $allocateQty;
                }

                // Sisa qty over-receipt → SLE pending
                if ($remainingQty > 0) {
                    // 1. Update Stock queue dulu
                    $queue[] = [
                        'rate'            => $poItem->rate,
                        'quantity'        => $remainingQty,
                        'is_valuated'     => false,
                        'sle_id'          => null,
                        'receipt_item_id' => $item->id,
                    ];
                    $stock->update([
                        'stock_queue' => $queue,
                        'quantity'    => $stock->quantity + $remainingQty,
                    ]);
                    $stock->refresh();

                    // 2. Buat SLE dengan data Stock final
                    $sle = StockLedgerEntry::create([
                        'item_id'                    => $item->item_id,
                        'warehouse_id'               => $item->target_warehouse_id,
                        'item_unit_id'               => $defaultUom->id,
                        'conversion_factor'          => $defaultConvertionFactor,
                        'quantity_change'            => $remainingQty,
                        'quantity_after_transaction' => $stock->actual_quantity,
                        'valuation_rate'             => 0,
                        'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                        'change_in_stock_value'      => 0,
                        'stock_queue'                => $stock->stock_queue,
                        'referenceable_type'         => PurchaseReceipt::class,
                        'referenceable_id'           => $purchaseReceipt->id,
                        'is_valuated'                => false,
                        'transaction_date'           => now(),
                    ]);

                    // 3. Patch queue entry terakhir dengan sle_id
                    $queue[array_key_last($queue)]['sle_id'] = $sle->id;
                    $stock->update(['stock_queue' => $queue]);
                }

                $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
                $poItem->increment('received_quantity', $quantity);

            } else {
                // === ALUR-1: Receipt duluan, belum ada Invoice ===

                // 1. Update Stock queue dulu (sle_id null sementara)
                $queue[] = [
                    'rate'            => $poItem->rate,
                    'quantity'        => $quantity,
                    'is_valuated'     => false,
                    'sle_id'          => null,
                    'receipt_item_id' => $item->id,
                ];
                $stock->update([
                    'stock_queue' => $queue,
                    'quantity'    => $stock->quantity + $quantity,
                ]);
                $poItem->increment('received_quantity', $quantity);
                $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
                $stock->refresh();

                // 2. Buat SLE dengan data Stock yang sudah final
                $sle = StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->target_warehouse_id,
                    'item_unit_id'               => $defaultUom->id,
                    'conversion_factor'          => $defaultConvertionFactor,
                    'quantity_change'            => $quantity,
                    'quantity_after_transaction' => $stock->actual_quantity,
                    'valuation_rate'             => 0,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                    'change_in_stock_value'      => 0,
                    'stock_queue'                => $stock->stock_queue,
                    'referenceable_type'         => PurchaseReceipt::class,
                    'referenceable_id'           => $purchaseReceipt->id,
                    'is_valuated'                => false,
                    'transaction_date'           => now(),
                ]);

                // 3. Patch queue entry terakhir dengan sle_id
                $queue[array_key_last($queue)]['sle_id'] = $sle->id;
                $stock->update(['stock_queue' => $queue]);
            }
        }

        // === UPDATE STATUS PO ===
        event(new PurchaseOrderReceiveStatusRecalculationRequested($purchaseOrder));
        event(new PurchaseRequestReceiveStatusRecalculationRequested($purchaseOrder));

        // === GL Stock/SRNB: dipindah ke queued Job ===
        if ($returnAgainst || $totalRatesForGL > 0) {
            GlPostingStatus::create([
                'referenceable_type' => PurchaseReceipt::class,
                'referenceable_id'   => $purchaseReceipt->id,
                'status'             => FormStatus::PENDING,
            ]);
            event(new PurchaseReceiptGeneralLedgerPostingRequested(
                $purchaseReceipt,
                $returnAgainst
                    ? $purchaseReceipt->items->sum(fn ($i) => $i->purchaseOrderItem->rate * ($i->quantity * $i->conversion_factor / $stocks->get("{$i->item_id}-{$i->target_warehouse_id}")?->conversion_factor ?? 1))
                    : $totalRatesForGL,
                (bool) $returnAgainst,
                now(),
            ));
        }

        DB::commit();

        // Dispatch FixedAssetItemApproved for each fixed-asset item
        foreach ($items as $item) {
            $variant = $item->item;
            if (! $variant || ! $variant->item || ! $variant->item->is_fixed_asset) {
                continue;
            }
            FixedAssetItemApproved::dispatch($purchaseReceipt, $item, $variant->item);
        }

        return $purchaseReceipt;
    }

    private function findInvoiceItemsForPoItem($poItem, PurchaseOrder $purchaseOrder): Collection {
        $invoiceIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseInvoice::class)
            ->pluck('reference_id');

        return PurchaseInvoiceItem::whereIn('purchase_invoice_id', $invoiceIds)
            ->where('purchase_order_item_id', $poItem->id)
            ->whereHas('purchaseInvoice', fn ($q) => $q->whereNotNull('submitted_at'))
            ->with('purchaseInvoice')
            ->lockForUpdate()
            ->get()
            ->sortBy('purchaseInvoice.date');
    }

    public function onRejected(Model $purchaseReceipt): mixed {
        $purchaseReceipt->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        return $purchaseReceipt;
    }

    public function cancel(Model $purchaseReceipt): mixed {
        $purchaseReceipt->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        return $purchaseReceipt;
    }
}
