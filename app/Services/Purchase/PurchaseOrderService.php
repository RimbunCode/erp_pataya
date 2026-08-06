<?php

namespace App\Services\Purchase;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class PurchaseOrderService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        $data['supplier_id']   = $data['supplier']['id'];
        $data['supplier_name'] = Supplier::find($data['supplier']['id'])?->name;

        $defaultCurrency            = Preference::find('default_currency_id')?->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate'] = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];

        return $data;
    }

    private function fillItemRelations(array $data, PurchaseOrder $purchaseOrder, array $units = [], array $taxes = []) {
        $unit                        = $units[$data['unit']['id']] ?? null;
        $tax                         = $taxes[$data['tax']['id'] ?? ''] ?? null;
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $data['exchange_rate']       = $purchaseOrder->exchange_rate;
        $data['tax_id']              = $data['tax']['id'];
        $data['tax_rate']            = $tax?->rate ?? 0;
        $data['target_warehouse_id'] = $data['target_warehouse']['id'];

        return $data;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    private function batchLoadTaxes(array $data): array {
        $taxIds = collect($data['items'])->pluck('tax.id')->filter()->unique()->values();

        return Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();
    }

    private function fillPaymentScheduleRelations(array $data, PurchaseOrder $purchaseOrder) {
        $data['payment_amount']     = $purchaseOrder->amount * ($data['invoice_portion'] / 100);
        $data['currency_code']      = $purchaseOrder->currency_code;
        $data['base_currency_code'] = $purchaseOrder->base_currency_code;
        $data['exchange_rate']      = $purchaseOrder->exchange_rate;
        $data['for_internal']       = true;
        $data['payment_method_id']  = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Model {
        $data['code']  = FormatingSeries::generate(PurchaseOrder::class, $data, true);
        $purchaseOrder = PurchaseOrder::create($this->fillRelations($data));

        $basicAmount = 0;
        $taxAmount   = 0;

        $units = $this->batchLoadUnits($data);
        $taxes = $this->batchLoadTaxes($data);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseOrder, $units, $taxes);
            $item = $purchaseOrder->items()->create($item);
            $item->refresh();
            $basicAmount += $item->basic_amount;
            $taxAmount += $item->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseOrder->discount_on, $purchaseOrder->discount_amount);
        $purchaseOrder->update([
            'amount' => $totalAmount,
        ]);

        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
            $purchaseOrder->paymentSchedules()->create([
                ...$payment_schedule,
            ]);
        }
        $purchaseOrder->logForCreated();

        return $purchaseOrder;
    }

    public function update(Model $purchaseOrder, array $data): Model {
        $purchaseOrder->fillForUpdate($this->fillRelations($data));

        $basicAmount = 0;
        $taxAmount   = 0;

        $purchaseOrder->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $purchaseOrder->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units = $this->batchLoadUnits($data);
        $taxes = $this->batchLoadTaxes($data);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $purchaseOrder, $units, $taxes);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                    $itemModel->refresh();
                } else {
                    $itemModel = $purchaseOrder->items()->create($item);
                    $itemModel->refresh();
                }
            } else {
                $itemModel = $purchaseOrder->items()->create($item);
                $itemModel->refresh();
            }

            $basicAmount += $itemModel->basic_amount;
            $taxAmount += $itemModel->tax_amount;
        }

        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $purchaseOrder->discount_on, $purchaseOrder->discount_amount);
        $purchaseOrder->update([
            'total_amount'               => $totalAmount,
            'total_amount_base_currency' => $totalAmount * ($purchaseOrder->exchange_rate ?? 1),
        ]);

        if (\array_key_exists('payment_schedules', $data)) {

            $purchaseOrder->paymentSchedules()
                ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
                ->delete();
            $paymentScheduleIds = collect($data['payment_schedules'])
                ->pluck('id')
                ->filter(fn ($id) => Ulid::isValid((string) $id))
                ->values()
                ->all();
            $existingPaymentSchedules = $purchaseOrder->paymentSchedules()
                ->whereIn('id', $paymentScheduleIds)
                ->get()
                ->keyBy('id');
            foreach ($data['payment_schedules'] as $payment_schedule) {
                $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
                if (Ulid::isValid($payment_schedule['id'])) {
                    $existingPaymentSchedules->get($payment_schedule['id'])?->update([
                        ...$payment_schedule,
                    ]);

                    continue;
                }
                $purchaseOrder->paymentSchedules()->create([
                    ...$payment_schedule,
                ]);
            }
        }

        $purchaseOrder->logForUpdated();

        return $purchaseOrder;
    }

    public function submit(Model $purchaseOrder): mixed {
        DB::beginTransaction();

        // ensure payment schedule portions valid when provided
        if ($purchaseOrder->paymentSchedules()->exists()) {
            $totalInvoicePortion = $purchaseOrder->paymentSchedules()->sum('invoice_portion');
            if ($totalInvoicePortion != 100) {
                DB::rollBack();
                throw ValidationException::withMessages([
                    'invoice_portion' => 'Total invoice portion must be 100%',
                ]);
            }
        }

        $purchaseOrder->update([
            'code' => FormatingSeries::generate(PurchaseOrder::class, $purchaseOrder),
        ]);

        $items = $purchaseOrder->items()
            ->with(['item'])
            ->get();

        /** @var Collection<string, Stock> $stocks */
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('target_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");

        foreach ($items as $item) {
            if (! $item->item->is_stock_item) {
                continue;
            }

            $stockKey = "{$item->item_id}-{$item->target_warehouse_id}";
            /** @var Stock|null $stock */
            $stock = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $stock->updateDetails('increment', 'incomings', $purchaseOrder->code, $quantity);
        }

        DB::commit();
        $purchaseOrder->checkApproval();

        return $purchaseOrder;
    }

    public function onApproved(Model $purchaseOrder): mixed {
        DB::beginTransaction();
        $purchaseOrder->update([
            'status' => [FormStatus::TO_RECEIVE, FormStatus::TO_BILL],
        ]);

        $items = $purchaseOrder->items()
            ->whereNotNull('referenceable_type')
            ->whereNotNull('referenceable_id')
            ->with([
                'referenceable',
                'referenceable.parentRelation',
                'referenceable.referenceable',
                'referenceable.referenceable.parentRelation',
            ])
            ->get();

        foreach ($items as $item) {
            $purchaseOrder->attachConnections($item, [
                'ordered_quantity' => $item->quantity,
            ]);
        }

        ModelConnection::getReferenceAttributes(PurchaseOrderItem::class, $items->pluck('id')->toArray(), function ($connections, $reference) {
            $sumOrderedQty = $connections->sum('data.ordered_quantity');
            $reference->update([
                'ordered_quantity' => $sumOrderedQty,
            ]);
        });

        DB::commit();

        return $purchaseOrder;
    }

    private function rolllbackItems(PurchaseOrder $purchaseOrder) {
        $items = $purchaseOrder->items()
            ->get();
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('target_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->target_warehouse_id}";
            $stock    = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
        }
    }

    public function onRejected(Model $purchaseOrder): mixed {
        DB::beginTransaction();
        $purchaseOrder->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        $this->rolllbackItems($purchaseOrder);

        DB::commit();

        return $purchaseOrder;
    }

    public function cancel(Model $purchaseOrder): mixed {
        DB::beginTransaction();
        $purchaseOrder->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        $this->rolllbackItems($purchaseOrder);

        DB::commit();

        return $purchaseOrder;
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    /**
     * Rekonsiliasi PO items berdasarkan data dari Invoice & Receipt terkait.
     * Group per [rate, tax_id, tax_rate, warehouse_id]. Jika >1 group → split item.
     */
    public function syncItems(PurchaseOrder $purchaseOrder): array {
        return DB::transaction(function () use ($purchaseOrder) {
            $purchaseOrder->loadMissing('items');

            $receiptIds = ModelConnection::where('model_type', PurchaseOrder::class)
                ->where('model_id', $purchaseOrder->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->pluck('reference_id');

            $invoiceIds = ModelConnection::where('model_type', PurchaseOrder::class)
                ->where('model_id', $purchaseOrder->id)
                ->where('reference_type', PurchaseInvoice::class)
                ->pluck('reference_id');

            $syncLog = [];

            foreach ($purchaseOrder->items as $poItem) {
                $invItems = PurchaseInvoiceItem::whereIn('purchase_invoice_id', $invoiceIds)
                    ->where('purchase_order_item_id', $poItem->id)
                    ->get();

                $recItems = PurchaseReceiptItem::whereIn('purchase_receipt_id', $receiptIds)
                    ->where('purchase_order_item_id', $poItem->id)
                    ->get();

                if ($invItems->isEmpty() && $recItems->isEmpty()) {
                    continue;
                }

                // Build groups: key = "rate|tax_id|tax_rate|warehouse_id"
                $groups = collect();

                foreach ($invItems as $ii) {
                    $key      = "{$ii->rate}|{$ii->tax_id}|{$ii->tax_rate}|{$poItem->target_warehouse_id}";
                    $existing = $groups->get($key, [
                        'qty'                     => 0,
                        'rate'                    => $ii->rate,
                        'tax_id'                  => $ii->tax_id,
                        'tax_rate'                => $ii->tax_rate,
                        'warehouse_id'            => $poItem->target_warehouse_id,
                        'source_invoice_item_ids' => [],
                        'source_receipt_item_ids' => [],
                    ]);
                    $existing['qty'] += $ii->quantity;
                    $existing['source_invoice_item_ids'][] = $ii->id;
                    $groups->put($key, $existing);
                }

                foreach ($recItems as $ri) {
                    $wh  = $ri->target_warehouse_id ?? $poItem->target_warehouse_id;
                    $key = "{$poItem->rate}|{$poItem->tax_id}|{$poItem->tax_rate}|{$wh}";

                    if ($groups->has($key)) {
                        // Merge qty ke group yang sudah ada dari invoice
                        $existing                              = $groups->get($key);
                        $existing['source_receipt_item_ids'][] = $ri->id;
                        $groups->put($key, $existing);
                    } else {
                        $existing = $groups->get($key, [
                            'qty'                     => 0,
                            'rate'                    => $poItem->rate,
                            'tax_id'                  => $poItem->tax_id,
                            'tax_rate'                => $poItem->tax_rate,
                            'warehouse_id'            => $wh,
                            'source_invoice_item_ids' => [],
                            'source_receipt_item_ids' => [],
                        ]);
                        $existing['qty'] += $ri->quantity;
                        $existing['source_receipt_item_ids'][] = $ri->id;
                        $groups->put($key, $existing);
                    }
                }

                if ($groups->count() === 1) {
                    // Satu group → update PO item langsung
                    $g = $groups->first();
                    $poItem->update([
                        'rate'                => $g['rate'],
                        'tax_id'              => $g['tax_id'],
                        'tax_rate'            => $g['tax_rate'],
                        'target_warehouse_id' => $g['warehouse_id'],
                    ]);
                    $poItem->refresh();
                    $syncLog[] = ['action' => 'update', 'po_item_id' => $poItem->id, 'rate' => $g['rate']];
                } else {
                    // Banyak group → split: soft-delete item lama, buat item baru
                    $parentId = $poItem->id;
                    $poItem->delete();

                    foreach ($groups as $g) {
                        $newItem = $poItem->replicate()->fill([
                            'quantity'            => $g['qty'],
                            'rate'                => $g['rate'],
                            'tax_id'              => $g['tax_id'],
                            'tax_rate'            => $g['tax_rate'],
                            'target_warehouse_id' => $g['warehouse_id'],
                            'received_quantity'   => 0,
                            'billed_quantity'     => 0,
                            'parent_item_id'      => $parentId,
                        ]);
                        $newItem->id = (string) Str::ulid();
                        $newItem->save();
                        $newItem->refresh();

                        // Hitung qty proporsional dari source IDs group (FK tidak diubah)
                        $newReceived = empty($g['source_receipt_item_ids']) ? 0
                            : PurchaseReceiptItem::whereIn('id', $g['source_receipt_item_ids'])->sum('quantity');
                        $newBilled = empty($g['source_invoice_item_ids']) ? 0
                            : PurchaseInvoiceItem::whereIn('id', $g['source_invoice_item_ids'])->sum('quantity');
                        $newItem->update([
                            'received_quantity' => $newReceived,
                            'billed_quantity'   => $newBilled,
                        ]);

                        $syncLog[] = [
                            'action'              => 'split',
                            'original_po_item_id' => $parentId,
                            'new_po_item_id'      => $newItem->id,
                            'rate'                => $g['rate'],
                            'qty'                 => $g['qty'],
                        ];
                    }
                }
            }

            // Rekalkulasi total PO
            $purchaseOrder->load('items');
            $basicAmount = $purchaseOrder->items->sum('basic_amount');
            $taxAmount   = $purchaseOrder->items->sum('tax_amount');
            $purchaseOrder->update([
                'amount' => Utils::countAmount($basicAmount, $taxAmount, $purchaseOrder->discount_on, $purchaseOrder->discount_amount),
            ]);

            // Update status receive/bill
            $this->updatePurchaseOrderStatus($purchaseOrder);

            // Audit trail
            ModelConnection::create([
                'model_type'     => PurchaseOrder::class,
                'model_id'       => $purchaseOrder->id,
                'reference_type' => 'sync',
                'reference_id'   => (string) Str::ulid(),
                'data'           => [
                    'type'      => 'items_sync',
                    'timestamp' => now()->toISOString(),
                    'splits'    => $syncLog,
                ],
            ]);

            return $syncLog;
        });
    }

    /**
     * Validasi receipt qty == invoice qty per item, lalu sync + status COMPLETED
     */
    public function markDone(PurchaseOrder $purchaseOrder): array {
        return DB::transaction(function () use ($purchaseOrder) {
            $purchaseOrder->items()->lockForUpdate()->get();

            $receiptIds = ModelConnection::where('model_type', PurchaseOrder::class)
                ->where('model_id', $purchaseOrder->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->pluck('reference_id');

            $invoiceIds = ModelConnection::where('model_type', PurchaseOrder::class)
                ->where('model_id', $purchaseOrder->id)
                ->where('reference_type', PurchaseInvoice::class)
                ->pluck('reference_id');

            $mismatches = [];

            foreach ($purchaseOrder->items as $poItem) {
                $receivedQty = PurchaseReceiptItem::whereIn('purchase_receipt_id', $receiptIds)
                    ->where('purchase_order_item_id', $poItem->id)
                    ->sum('quantity');

                $billedQty = PurchaseInvoiceItem::whereIn('purchase_invoice_id', $invoiceIds)
                    ->where('purchase_order_item_id', $poItem->id)
                    ->sum('quantity');

                if ((float) $receivedQty !== (float) $billedQty) {
                    $mismatches[] = [
                        'item_name'    => $poItem->item_name,
                        'received_qty' => $receivedQty,
                        'billed_qty'   => $billedQty,
                    ];
                }
            }

            if (! empty($mismatches)) {
                throw ValidationException::withMessages([
                    'mismatches' => $mismatches,
                ]);
            }

            $syncLog = $this->syncItems($purchaseOrder);

            $purchaseOrder->update([
                'status' => Utils::replaceStatus(
                    $purchaseOrder->fresh()->status,
                    [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED, FormStatus::RECEIVED,
                        FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::BILLED],
                    FormStatus::COMPLETED,
                ),
            ]);

            ModelConnection::create([
                'model_type'     => PurchaseOrder::class,
                'model_id'       => $purchaseOrder->id,
                'reference_type' => 'mark_done',
                'reference_id'   => (string) Str::ulid(),
                'data'           => [
                    'type'      => 'mark_done',
                    'timestamp' => now()->toISOString(),
                    'sync_log'  => $syncLog,
                ],
            ]);

            return ['success' => true, 'sync_log' => $syncLog];
        });
    }

    /**
     * Update kedua status receive & bill di PO setelah sync
     */
    private function updatePurchaseOrderStatus(PurchaseOrder $purchaseOrder): void {
        $purchaseOrder->load('items');
        $items         = $purchaseOrder->items;
        $totalQty      = $items->sum('quantity');
        $totalReceived = $items->sum('received_quantity');
        $totalBilled   = $items->sum('billed_quantity');

        $currentStatus = $purchaseOrder->fresh()->status;

        // Receive status
        if ($totalReceived == 0) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::RECEIVED, FormStatus::PARTIALLY_RECEIVED, FormStatus::OVER_RECEIVED],
                FormStatus::TO_RECEIVE,
            );
        } elseif ($totalReceived > $totalQty) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED, FormStatus::RECEIVED],
                FormStatus::OVER_RECEIVED,
            );
        } elseif ($totalReceived < $totalQty) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_RECEIVE, FormStatus::RECEIVED, FormStatus::OVER_RECEIVED],
                FormStatus::PARTIALLY_RECEIVED,
            );
        } else {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED, FormStatus::OVER_RECEIVED],
                FormStatus::RECEIVED,
            );
        }

        // Bill status
        if ($totalBilled == 0) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::BILLED, FormStatus::PARTIALLY_BILLED, FormStatus::OVER_BILLED],
                FormStatus::TO_BILL,
            );
        } elseif ($totalBilled > $totalQty) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::BILLED],
                FormStatus::OVER_BILLED,
            );
        } elseif ($totalBilled < $totalQty) {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_BILL, FormStatus::BILLED, FormStatus::OVER_BILLED],
                FormStatus::PARTIALLY_BILLED,
            );
        } else {
            $currentStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::OVER_BILLED],
                FormStatus::BILLED,
            );
        }

        $purchaseOrder->update(['status' => $currentStatus]);
    }
}
