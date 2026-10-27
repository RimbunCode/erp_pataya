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
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\PurchaseSetting;
use App\Services\Core\Setting\ToleranceCalculator;
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
        $unit                = $units[$data['unit']['id']] ?? null;
        $purchaseOrderItemId = $data['purchase_order_item_id'] ?? null;
        $isOffPo             = ! $purchaseOrderItemId;

        // Baris di luar PO (spec purchase-receipt-off-po-items): item_id dari input
        // `item.id`; kolom substitusi hanya berlaku di baris tanpa PO Item.
        $data['purchase_order_item_id']          = $purchaseOrderItemId;
        $data['item_id']                         = $isOffPo ? $data['item']['id'] : $purchaseOrderItems[$purchaseOrderItemId]->item_id;
        $data['replaces_purchase_order_item_id'] = $isOffPo ? ($data['replaces_purchase_order_item_id'] ?? null) : null;
        $data['replaced_quantity']               = $data['replaces_purchase_order_item_id'] ? ($data['replaced_quantity'] ?? null) : null;
        $data['item_unit_id']                    = $data['unit']['id'];
        $data['conversion_factor']               = $unit?->conversion_factor ?? 1;
        $data['target_warehouse_id']             = $data['target_warehouse']['id'] ?? '';

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
            $item                      = $this->fillItemRelations($item, $units, $purchaseOrderItems);
            $item['purchase_order_id'] = $purchaseReceipt->purchase_order_id;
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
            $item                      = $this->fillItemRelations($item, $units, $purchaseOrderItems);
            $item['purchase_order_id'] = $purchaseReceipt->purchase_order_id;

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
                'replacesPurchaseOrderItem',
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

        // Guard sisa PO Item yang digantikan: dihitung ulang di bawah lock (validasi
        // request hanya melihat snapshot saat simpan). Gagal jelas via error bag.
        $replacedByItem = $returnAgainst
            ? collect()
            : $items->filter(fn ($row) => $row->replaces_purchase_order_item_id)
                ->groupBy('replaces_purchase_order_item_id');
        $replacedErrors      = [];
        $replacedFlagged     = [];
        $receiptTolerance    = PurchaseSetting::current()->over_receipt_tolerance_percent;
        $toleranceCalculator = app(ToleranceCalculator::class);
        foreach ($replacedByItem as $replacedId => $rows) {
            $locked    = PurchaseOrderItem::where('id', $replacedId)->lockForUpdate()->first();
            $requested = (float) $rows->sum('replaced_quantity');
            $remaining = $locked
                ? ($toleranceCalculator->allowed((float) $locked->quantity, (float) $locked->received_quantity, $receiptTolerance)
                    ?? ((float) $locked->quantity - (float) $locked->received_quantity))
                : 0;
            if (! $locked || $requested - $remaining > 0.0001) {
                $replacedFlagged[$replacedId] = true;
                $replacedErrors[]             = __('purchase/purchaseReceipt.validation.replaced_exceeds_remaining_on_approve', [
                    'item'      => $locked?->item?->code ?? $replacedId,
                    'remaining' => $remaining,
                    'quantity'  => $requested,
                ]);
            }
        }

        // Kuantitas baris normal + porsi yang digantikan baris pengganti dijumlahkan per PO Item
        // dalam satu batas (lock PO Item diambil di dalam guard). PO Item yang sudah ditolak
        // pemeriksaan sisa di atas dilewati agar tak ada pesan ganda.
        if (! $returnAgainst) {
            $guardRows = $items->map(fn ($row) => [
                'purchase_order_item_id'          => $row->purchase_order_item_id,
                'quantity'                        => $row->quantity,
                'conversion_factor'               => $row->conversion_factor,
                'replaces_purchase_order_item_id' => $row->replaces_purchase_order_item_id,
                'replaced_quantity'               => $row->replaced_quantity,
            ])->all();
            foreach (app(PurchaseReceiptToleranceGuard::class)->violations($guardRows, $receiptTolerance, $replacedFlagged, lock: true) as $violation) {
                $replacedErrors[] = __('purchase/purchaseReceipt.validation.over_receipt_tolerance_exceeded', [
                    'remaining' => $violation['remaining'],
                    'limit'     => $violation['limit'],
                ]);
            }
        }
        if (\count($replacedErrors) > 0) {
            DB::rollBack();
            throw ValidationException::withMessages(['items' => $replacedErrors]);
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
        // Total nilai retur untuk GL: dihitung di dalam loop supaya baris tanpa
        // PO Item (di luar PO) tidak bergantung pada purchaseOrderItem->rate.
        $returnTotalForGL = 0;

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
                // Lock returnAgainstItem sebelum baca-modifikasi-tulis (Req 1.3)
                $returnAgainstItem = $item->returnAgainstItem()->lockForUpdate()->first();

                if ($poItem) {
                    $totalRate = $poItem->rate * $quantity;

                    for ($i = \count($queue) - 1; $i >= 0; $i--) {
                        if ($queue[$i]['rate'] == $poItem->rate) {
                            $queue[$i]['quantity'] -= $quantity;
                            break;
                        }
                    }
                } else {
                    // Baris di luar PO: tarif dari entri queue milik baris receipt asal
                    // (receipt_item_id), bukan dari rate PO Item yang memang tak ada.
                    $totalRate       = 0;
                    $remainingReturn = $quantity;
                    for ($i = \count($queue) - 1; $i >= 0 && $remainingReturn > 0; $i--) {
                        if (($queue[$i]['receipt_item_id'] ?? null) !== $item->return_against_item_id) {
                            continue;
                        }
                        $take = min($queue[$i]['quantity'], $remainingReturn);
                        $queue[$i]['quantity'] -= $take;
                        $totalRate += $queue[$i]['rate'] * $take;
                        $remainingReturn -= $take;
                    }
                    if ($remainingReturn > 0) {
                        $totalRate += $remainingReturn * ($stock->valuation_rate ?? 0);
                    }
                }
                $returnTotalForGL += $totalRate;

                $stock->update([
                    'stock_queue' => $queue,
                    'quantity'    => $stock->quantity - $quantity,
                ]);
                if ($poItem) {
                    $stock->updateDetails('increment', 'incomings', $purchaseOrder->code, $quantity);
                }
                $returnAgainstItem->increment('returned_quantity', $quantity);
                if ($poItem) {
                    $poItem->decrement('received_quantity', $quantity);
                } else {
                    $this->reverseSubstitution($returnAgainstItem, $item, $purchaseOrder);
                }
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
            // Lock PO Item untuk mencegah race condition pada billed_quantity (Req 1.1).
            // Sumber nilai/ALUR = PO Item baris (normal), atau PO Item yang digantikan
            // (substitusi); baris berdiri sendiri tak punya sumber -> selalu ALUR-1.
            $valuationItem = $poItem ?? $item->replacesPurchaseOrderItem;
            if ($valuationItem) {
                $valuationItem = PurchaseOrderItem::where('id', $valuationItem->id)->lockForUpdate()->first();
            }
            $replacedItem    = $poItem ? null : $valuationItem;
            $poItem          = $poItem ? $valuationItem : null;
            $isStandalone    = ! $valuationItem;
            $isAlreadyBilled = $valuationItem && $valuationItem->billed_quantity > 0;

            // Baris berdiri sendiri: invoice item bebas (spec purchase-invoice-off-po-items)
            // yang sudah di-approve duluan = ALUR-2 tanpa PO Item.
            $freeInvoiceItems = $isStandalone ? $this->findFreeInvoiceItems($item, $purchaseOrder) : collect();
            if ($isStandalone) {
                $isAlreadyBilled = $freeInvoiceItems->isNotEmpty();
            }

            if ($isAlreadyBilled) {
                // === ALUR-2: Invoice approve duluan → Receipt kemudian ===
                $invoiceItems = $isStandalone ? $freeInvoiceItems : $this->findInvoiceItemsForPoItem($valuationItem, $purchaseOrder);
                $remainingQty = $quantity;
                // Substitusi: yang dinilai dari invoice hanya porsi yang menggantikan
                // PO Item (replaced_quantity); kelebihannya masuk SLE pending di bawah.
                $budget = $replacedItem ? min($quantity, (float) $item->replaced_quantity) : $quantity;

                foreach ($invoiceItems as $invoiceItem) {
                    if ($remainingQty <= 0 || $budget <= 0) {
                        break;
                    }

                    // Kuantitas/rate invoice dalam satuan invoice; `$quantity` receipt dalam satuan stok.
                    // Hanya invoice item bebas (jalur baru) yang dikonversi; jalur PO-Item lama tetap
                    // memakai kuantitas apa adanya agar `allocated_qty` yang sudah tersimpan tidak berubah arti.
                    $toStock = $isStandalone
                        ? (float) ($invoiceItem->conversion_factor ?: 1) / (float) ($stock->conversion_factor ?: 1)
                        : 1.0;
                    $rate         = $invoiceItem->rate / $toStock;
                    $availableQty = ($invoiceItem->quantity - $invoiceItem->allocated_qty) * $toStock;
                    if ($availableQty <= 0) {
                        continue;
                    }

                    $allocateQty = min($remainingQty, $availableQty, $budget);

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

                    $invoiceItem->increment('allocated_qty', $allocateQty / $toStock);
                    if ($isStandalone) {
                        // porsi baris receipt yang sudah ditagih invoice item bebas (satuan baris receipt)
                        $item->increment('billed_quantity', $allocateQty * (float) ($stock->conversion_factor ?: 1) / (float) ($item->conversion_factor ?: 1));
                    }
                    $totalRatesForGL += $rate * $allocateQty;
                    $remainingQty -= $allocateQty;
                    $budget -= $allocateQty;
                }

                // Sisa qty over-receipt → SLE pending
                if ($remainingQty > 0) {
                    // 1. Update Stock queue dulu
                    $queue[] = [
                        'rate'            => $valuationItem?->rate ?? 0,
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

                $this->recordFulfilment($item, $poItem, $replacedItem, $stock, $quantity, $purchaseOrder);

            } else {
                // === ALUR-1: Receipt duluan, belum ada Invoice ===

                // 1. Update Stock queue dulu (sle_id null sementara)
                $queue[] = [
                    'rate'            => $valuationItem?->rate ?? 0,
                    'quantity'        => $quantity,
                    'is_valuated'     => false,
                    'sle_id'          => null,
                    'receipt_item_id' => $item->id,
                ];
                $stock->update([
                    'stock_queue' => $queue,
                    'quantity'    => $stock->quantity + $quantity,
                ]);
                $this->recordFulfilment($item, $poItem, $replacedItem, $stock, $quantity, $purchaseOrder);
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
                $returnAgainst ? $returnTotalForGL : $totalRatesForGL,
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

    /**
     * Catat pemenuhan PO oleh satu baris receipt:
     *  - normal: reservasi `incomings` PO dilepas + received_quantity PO Item naik;
     *  - substitusi: PO Item yang digantikan dianggap terpenuhi sebesar
     *    `replaced_quantity` (received_quantity naik, `incomings` stok PO Item itu
     *    dilepas); `incomings` item pengganti tak disentuh (tak pernah direservasi);
     *  - berdiri sendiri: tidak menyentuh PO.
     */
    private function recordFulfilment(PurchaseReceiptItem $item, ?PurchaseOrderItem $poItem, ?PurchaseOrderItem $replacedItem, Stock $stock, float $quantity, PurchaseOrder $purchaseOrder): void {
        if ($poItem) {
            $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
            $poItem->increment('received_quantity', $quantity);

            return;
        }

        if ($replacedItem) {
            $replacedQuantity = (float) $item->replaced_quantity;
            $replacedItem->increment('received_quantity', $replacedQuantity);
            $this->adjustIncoming($replacedItem, $replacedQuantity, 'decrement', $purchaseOrder);
        }
    }

    /**
     * Retur baris substitusi: balik pemenuhan PO Item yang digantikan, proporsional
     * terhadap kuantitas yang diretur (`replaced_quantity × qty_retur ÷ qty_asal`).
     */
    private function reverseSubstitution(?PurchaseReceiptItem $returnAgainstItem, PurchaseReceiptItem $returnItem, PurchaseOrder $purchaseOrder): void {
        if (! $returnAgainstItem?->replaces_purchase_order_item_id) {
            return;
        }
        $replacedQuantity = (float) $returnAgainstItem->replaced_quantity;
        $originalQuantity = (float) $returnAgainstItem->quantity;
        if ($replacedQuantity <= 0 || $originalQuantity <= 0) {
            return;
        }

        $replacedItem = PurchaseOrderItem::where('id', $returnAgainstItem->replaces_purchase_order_item_id)->lockForUpdate()->first();
        if (! $replacedItem) {
            return;
        }

        $back = $replacedQuantity * ((float) $returnItem->quantity / $originalQuantity);
        $replacedItem->update(['received_quantity' => max(0, (float) $replacedItem->received_quantity - $back)]);
        $this->adjustIncoming($replacedItem, $back, 'increment', $purchaseOrder);
    }

    /**
     * Ubah reservasi `incomings` stok milik PO Item (kuantitas dalam satuan PO Item,
     * dikonversi ke satuan dasar stok seperti saat PO di-approve).
     */
    private function adjustIncoming(PurchaseOrderItem $poItem, float $quantity, string $operator, PurchaseOrder $purchaseOrder): void {
        $stock = Stock::where('item_variant_id', $poItem->item_id)
            ->where('warehouse_id', $poItem->target_warehouse_id)
            ->lockForUpdate()
            ->first();
        if (! $stock) {
            return;
        }

        $base = $quantity * ($poItem->conversion_factor ?: 1) / ($stock->conversion_factor ?: 1);
        $stock->updateDetails($operator, 'incomings', $purchaseOrder->code, $base);
    }

    /**
     * Invoice item bebas (tanpa PO Item & tanpa baris receipt) yang sudah di-approve pada
     * PO yang sama untuk item baris receipt berdiri sendiri ini, urut tanggal invoice,
     * dengan sisa `quantity − allocated_qty` > 0.
     */
    private function findFreeInvoiceItems(PurchaseReceiptItem $item, PurchaseOrder $purchaseOrder): Collection {
        return PurchaseInvoiceItem::whereNull('purchase_order_item_id')
            ->whereNull('purchase_receipt_item_id')
            ->where('item_id', $item->item_id)
            ->whereColumn('quantity', '>', 'allocated_qty')
            ->whereHas('purchaseInvoice', fn ($q) => $q->where('purchase_order_id', $purchaseOrder->id)
                ->whereNull('return_against_id')
                ->whereNull('canceled_at')
                ->where(fn ($status) => $status->whereJsonContains('status', FormStatus::UNPAID->value)
                    ->orWhereJsonContains('status', FormStatus::PARTIALLY_PAID->value)
                    ->orWhereJsonContains('status', FormStatus::PAID->value)))
            ->with('purchaseInvoice')
            ->lockForUpdate()
            ->get()
            ->sortBy('purchaseInvoice.date');
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
