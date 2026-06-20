<?php

namespace App\Services\Purchase;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Utils;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseReceiptService {
    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['return_against_id'] = $data['return_against']['id'] ?? null;

        return $data;
    }

    private function fillItemRelations(array $data) {
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $data['unit']['conversion_factor'];
        $data['target_warehouse_id'] = $data['target_warehouse']['id'] ?? '';

        return $data;
    }

    public function create(array $data) {
        $data['code']    = FormatingSeries::generate(PurchaseReceipt::class, $data, true);
        $purchaseReceipt = PurchaseReceipt::create($this->fillRelations($data));
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);
            $purchaseReceipt->items()->create($item);
        }
        $purchaseReceipt->logForCreated();

        return $purchaseReceipt;
    }

    public function update(PurchaseReceipt $purchaseReceipt, array $data) {
        $purchaseReceipt->fillForUpdate($this->fillRelations($data));

        $purchaseReceipt->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds       = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseReceipt->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);

            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

                continue;
            }

            $purchaseReceipt->items()->create($item);
        }

        $purchaseReceipt->logForUpdated();

        return $purchaseReceipt;
    }

    public function submit(PurchaseReceipt $purchaseReceipt) {
        DB::beginTransaction();

        $purchaseReceipt->update([
            'code' => FormatingSeries::generate(PurchaseReceipt::class, $purchaseReceipt),
        ]);
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $purchaseReceipt->purchase_order_id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $purchaseReceipt->id,
        ]);
        DB::commit();
        $purchaseReceipt->checkApproval();

        return $purchaseReceipt;
    }

    public function onApproved(PurchaseReceipt $purchaseReceipt) {
        DB::beginTransaction();
        $returnAgainst = $purchaseReceipt->returnAgainst;
        $purchaseReceipt->update([
            'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::RECEIVED,
        ]);

        $purchaseOrder = $purchaseReceipt->purchaseOrder;

        $items         = $purchaseReceipt->items()
            ->with([
                'item',
                'item.item',
                'item.defaultUom',
                'purchaseOrderItem',
                'targetWarehouse',
                'returnAgainstItem',
            ])->get();
        $stocks        = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
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
                $item->returnAgainstItem->increment('returned_quantity', $quantity);
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
                ]);

                continue;
            }

            // === DUAL FLOW: cek apakah Invoice sudah ada duluan ===
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
                    ]);

                    // 3. Patch queue entry terakhir dengan sle_id
                    $queue[array_key_last($queue)]['sle_id'] = $sle->id;
                    $stock->update(['stock_queue' => $queue]);

                    $invoiceItem->increment('allocated_qty', $allocateQty);
                    $totalRatesForGL += $rate * $allocateQty;
                    $remainingQty    -= $allocateQty;
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
                ]);

                // 3. Patch queue entry terakhir dengan sle_id
                $queue[array_key_last($queue)]['sle_id'] = $sle->id;
                $stock->update(['stock_queue' => $queue]);
            }
        }

        // === UPDATE STATUS PO ===
        $this->updatePurchaseOrderReceiveStatus($purchaseOrder);

        // === GL Stock/SRNB: Hanya untuk ALUR-2 (dan Return) ===
        if ($returnAgainst || $totalRatesForGL > 0) {
            $glAmount = $returnAgainst
                ? $purchaseReceipt->items->sum(fn ($i) => $i->purchaseOrderItem->rate * ($i->quantity * $i->conversion_factor / $stocks->get("{$i->item_id}-{$i->target_warehouse_id}")?->conversion_factor ?? 1))
                : $totalRatesForGL;

            $debitAccount = Account::lockForUpdate()
                ->where('root_type', 'asset')
                ->where('account_type', 'stock')
                ->latest()->first();

            $creditAccount = Account::lockForUpdate()
                ->where('root_type', 'liability')
                ->where('account_type', 'stock_received_but_not_billed')
                ->latest()->first();

            $creditAccount->generalLedgerEntries()->create([
                'against_account_id' => $debitAccount->id,
                'credit'             => $returnAgainst ? 0 : $glAmount,
                'debit'              => $returnAgainst ? $glAmount : 0,
                'referenceable_type' => PurchaseReceipt::class,
                'referenceable_id'   => $purchaseReceipt->id,
            ]);

            $debitAccount->generalLedgerEntries()->create([
                'against_account_id' => $creditAccount->id,
                'credit'             => $returnAgainst ? $glAmount : 0,
                'debit'              => $returnAgainst ? 0 : $glAmount,
                'referenceable_type' => PurchaseReceipt::class,
                'referenceable_id'   => $purchaseReceipt->id,
            ]);
        }

        DB::commit();

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
            ->get()
            ->sortBy('purchaseInvoice.date');
    }

    private function updatePurchaseOrderReceiveStatus(PurchaseOrder $purchaseOrder): void {
        $items         = $purchaseOrder->items()->select('quantity', 'received_quantity')->get();
        $totalQty      = $items->sum('quantity');
        $totalReceived = $items->sum('received_quantity');

        if ($totalReceived == 0) {
            $newStatus      = FormStatus::TO_RECEIVE;
            $removeStatuses = [FormStatus::RECEIVED, FormStatus::PARTIALLY_RECEIVED, FormStatus::OVER_RECEIVED];
        } elseif ($totalReceived > $totalQty) {
            $newStatus      = FormStatus::OVER_RECEIVED;
            $removeStatuses = [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED, FormStatus::RECEIVED];
        } elseif ($totalReceived < $totalQty) {
            $newStatus      = FormStatus::PARTIALLY_RECEIVED;
            $removeStatuses = [FormStatus::TO_RECEIVE, FormStatus::RECEIVED, FormStatus::OVER_RECEIVED];
        } else {
            $newStatus      = FormStatus::RECEIVED;
            $removeStatuses = [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED, FormStatus::OVER_RECEIVED];
        }

        $purchaseOrder->update([
            'status' => Utils::replaceStatus($purchaseOrder->status, $removeStatuses, $newStatus),
        ]);
    }

    public function onRejected(PurchaseReceipt $purchaseReceipt) {
        $purchaseReceipt->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        return $purchaseReceipt;
    }

    public function cancel(PurchaseReceipt $purchaseReceipt) {
        $purchaseReceipt->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        return $purchaseReceipt;
    }
}
