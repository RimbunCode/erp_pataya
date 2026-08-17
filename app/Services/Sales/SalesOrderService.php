<?php

namespace App\Services\Sales;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\DocumentSubmitted;
use App\Events\Inventory\StockReservationChanged;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Services\Finances\DocumentDiscountCalculator;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class SalesOrderService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        $data['customer_id']          = $data['customer']['id'];
        $data['customer_name']        = Customer::find($data['customer']['id'])?->name;
        $data['customer_branch_id']   = $data['customer_branch']['id'];
        $data['customer_branch_name'] = Branch::find($data['customer_branch']['id'])?->name;

        $defaultCurrency            = Preference::find('default_currency_id')?->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate'] = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];

        return $data;
    }

    private function fillItemRelations(array $data, SalesOrder $salesOrder, array $units = [], array $taxes = []) {
        $unit                        = $units[$data['unit']['id']] ?? null;
        $tax                         = $taxes[$data['tax']['id'] ?? ''] ?? null;
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $data['tax_id']              = $data['tax']['id'] ?? null;
        $data['tax_rate']            = $tax?->rate ?? 0;
        $data['currency_code']       = $salesOrder->currency_code;
        $data['base_currency_code']  = $salesOrder->base_currency_code;
        $data['exchange_rate']       = $salesOrder->exchange_rate;
        $data['source_warehouse_id'] = $data['source_warehouse']['id'] ?? null;
        $data['basic_amount']        = $data['quantity'] * $data['price'];

        // Requirement 4, spec asset-service-billing: baris referenceable ke
        // AssetService/AssetServiceConsumedItem (opsional) — TIDAK mengubah
        // logic ItemVariant existing di atas, cuma cabang baru untuk field baru.
        if (! empty($data['referenceable']['type']) && ! empty($data['referenceable']['id'])) {
            $data['referenceable_type'] = $data['referenceable']['type'];
            $data['referenceable_id']   = $data['referenceable']['id'];
        }

        return $data;
    }

    /**
     * Alokasikan diskon dokumen (jika ada) ke seluruh item, tulis basic_amount/tax_amount/
     * amount hasil alokasi ke tiap item model, lalu kembalikan total basic_amount & tax_amount
     * header. basic_amount/tax_amount/amount bukan generated column lagi (lihat migration
     * convert_sales_order_items_amounts_to_stored_columns) -- Service layer ini yang jadi
     * satu-satunya penulis nilai tsb. discount_amount selalu dipakai sebagai nilai otoritatif
     * (bukan discount_rate) -- lihat catatan yang sama di PurchaseOrderService.
     *
     * @param  Collection<int, SalesOrderItem>  $items
     * @return array{basic_amount: float, tax_amount: float}
     */
    private function applyDiscountToItems(SalesOrder $salesOrder, Collection $items): array {
        $lines = $items->map(fn (SalesOrderItem $item) => [
            'basic_amount' => $item->basic_amount,
            'tax_rate'     => $item->tax_rate,
        ])->all();

        $allocated = DocumentDiscountCalculator::allocate(
            $lines,
            $salesOrder->discount_on,
            $salesOrder->discount_rate ?? 0,
            $salesOrder->discount_amount ?? 0,
            'discount_amount',
        );

        $basicAmount = 0;
        $taxAmount   = 0;
        foreach ($items->values() as $index => $item) {
            $item->forceFill($allocated[$index])->save();
            $basicAmount += $allocated[$index]['basic_amount'];
            $taxAmount += $allocated[$index]['tax_amount'];
        }

        return ['basic_amount' => $basicAmount, 'tax_amount' => $taxAmount];
    }

    private function fillPaymentScheduleRelations(array $data, SalesOrder $salesOrder) {
        $data['payment_amount']     = $salesOrder->amount * ($data['invoice_portion'] / 100);
        $data['currency_code']      = $salesOrder->currency_code;
        $data['base_currency_code'] = $salesOrder->base_currency_code;
        $data['exchange_rate']      = $salesOrder->exchange_rate;
        $data['for_internal']       = false;

        $data['payment_method_id'] = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(SalesOrder::class, $data, true);
        $salesOrder   = SalesOrder::create($this->fillRelations($data));

        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();
        $units   = ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
        $taxIds  = collect($data['items'])->pluck('tax.id')->filter()->unique()->values();
        $taxes   = Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();

        $items = collect();
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesOrder, $units, $taxes);
            $items->push($salesOrder->items()->create($item));
        }

        $totals = $this->applyDiscountToItems($salesOrder, $items);
        $salesOrder->update([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);
        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
            $salesOrder->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }

        return $salesOrder;
    }

    public function update(Model $salesOrder, array $data): Model {
        $salesOrder->fillForUpdate($this->fillRelations($data), true);

        $salesOrder->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $salesOrder->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();
        $units   = ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
        $taxIds  = collect($data['items'])->pluck('tax.id')->filter()->unique()->values();
        $taxes   = Tax::whereIn('id', $taxIds)->get()->keyBy('id')->all();

        $items = collect();
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesOrder, $units, $taxes);

            if (Ulid::isValid($item['id'])) {
                $itemModel = $existingItems->get($item['id']);
                if ($itemModel) {
                    $itemModel->fill($item);
                    $itemModel->save();
                } else {
                    $itemModel = $salesOrder->items()->create($item);
                }
            } else {
                $itemModel = $salesOrder->items()->create($item);
            }

            $items->push($itemModel);
        }

        $totals = $this->applyDiscountToItems($salesOrder, $items);
        $salesOrder->fill([
            'amount' => $totals['basic_amount'] + $totals['tax_amount'],
        ]);
        $salesOrder->save();

        $salesOrder->paymentSchedules()
            ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
            ->delete();
        $paymentScheduleIds = collect($data['payment_schedules'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingPaymentSchedules = $salesOrder->paymentSchedules()
            ->whereIn('id', $paymentScheduleIds)
            ->get()
            ->keyBy('id');
        foreach ($data['payment_schedules'] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
            if (Ulid::isValid($payment_schedule['id'])) {
                $existingPaymentSchedules->get($payment_schedule['id'])?->update($payment_schedule);

                continue;
            }
            $salesOrder->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }

        return $salesOrder;
    }

    public function submit(Model $salesOrder): mixed {
        DB::beginTransaction();

        $salesOrder->update([
            'code' => FormatingSeries::generate(SalesOrder::class, $salesOrder),
        ]);

        if ($salesOrder->referenceable_type && $salesOrder->referenceable_id) {
            event(new DocumentSubmitted($salesOrder, $salesOrder->referenceable));
            $additionalData          = $salesOrder->referenceable->additional_data ?? [];
            $additionalData['order'] = true;
            $salesOrder->referenceable->update(['additional_data' => $additionalData]);

            SalesOrder::where('referenceable_type', $salesOrder->referenceable_type)
                ->where('referenceable_id', $salesOrder->referenceable_id)
                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                ->whereNot('created_by_id', Auth::user()->id)
                ->update([
                    'status'      => 'canceled',
                    'canceled_at' => now(),
                ]);
        }
        $items = $salesOrder->items()
            ->with(['item', 'sourceWarehouse'])
            ->get();

        // Ambil semua stok yang dibutuhkan sekaligus untuk menghindari N+1
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");

        $isValid        = ! $salesOrder->is_rent;
        $errorItems     = [];
        $validatedItems = [];
        foreach ($items as $item) {
            if (! $item->item->is_stock_item) {
                continue;
            }
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            /** @var Stock $stock */
            $stock = $stocks->get($stockKey);

            $availableToRent = $item->item->type == 'vehicle';
            if ($salesOrder->is_rent && $availableToRent) {
                $isValid = true;
            }
            if (! $stock) {
                $errorItems[] = "Item {$item->item->name} is not in {$item->sourceWarehouse->name} stock";

                continue;
            }
            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            if ($stock->ready_quantity < $quantity) {
                $errorItems[] = "Item {$item->item->name} in {$item->sourceWarehouse->name} stock is {$stock->ready_quantity} but you need {$quantity}";

                continue;
            }
            $validatedItems[] = [
                'itemVariantId' => $item->item_id,
                'warehouseId'   => $item->source_warehouse_id,
                'quantity'      => $quantity,
            ];
        }
        if (! $isValid) {
            $errorItems[] = 'This order is not valid for renting';
        }
        if (\count($errorItems) > 0) {
            DB::rollBack();
            throw ValidationException::withMessages([
                'items' => $errorItems,
            ]);
        }

        if (\count($validatedItems) > 0) {
            event(new StockReservationChanged($salesOrder, 'increment', 'reservations', $validatedItems));
        }

        DB::commit();
        $salesOrder->checkApproval();

        return $salesOrder;
    }

    public function amend(Model $model): mixed {
        return $model;
    }

    public function onApproved(Model $salesOrder): mixed {
        $salesOrder->update([
            'status' => [
                FormStatus::TO_DELIVER,
                FormStatus::TO_BILL,
            ],
        ]);

        return $salesOrder;
    }

    public function updateSalesOrderStatus(SalesOrder $salesOrder): void {
        $salesOrder = SalesOrder::where('id', $salesOrder->id)->lockForUpdate()->firstOrFail();
        $salesOrder->loadMissing('items');
        $totalQty       = $salesOrder->items->sum('quantity');
        $totalDelivered = $salesOrder->items->sum('delivered_quantity');
        $totalBilled    = $salesOrder->items->sum('billed_quantity');

        $deliverStatus = FormStatus::TO_DELIVER;
        if ($totalDelivered > 0) {
            if ($totalDelivered > $totalQty) {
                $deliverStatus = FormStatus::OVER_DELIVERED;
            } elseif ($totalDelivered < $totalQty) {
                $deliverStatus = FormStatus::PARTIALLY_DELIVERED;
            } else {
                $deliverStatus = FormStatus::DELIVERED;
            }
        }

        $billStatus = FormStatus::TO_BILL;
        if ($totalBilled > 0) {
            if ($totalBilled > $totalQty) {
                $billStatus = FormStatus::OVER_BILLED;
            } elseif ($totalBilled < $totalQty) {
                $billStatus = FormStatus::PARTIALLY_BILLED;
            } else {
                $billStatus = FormStatus::BILLED;
            }
        }

        $status = Utils::replaceStatus($salesOrder->status, [
            FormStatus::TO_DELIVER,
            FormStatus::PARTIALLY_DELIVERED,
            FormStatus::DELIVERED,
            FormStatus::OVER_DELIVERED,
        ], $deliverStatus);

        $status = Utils::replaceStatus($status, [
            FormStatus::TO_BILL,
            FormStatus::PARTIALLY_BILLED,
            FormStatus::BILLED,
            FormStatus::OVER_BILLED,
        ], $billStatus);

        $salesOrder->update(['status' => $status]);
    }

    public function syncItems(SalesOrder $salesOrder): array {
        return DB::transaction(function () use ($salesOrder) {
            $salesOrder->loadMissing('items');

            $deliveryIds = ModelConnection::where('model_type', SalesOrder::class)
                ->where('model_id', $salesOrder->id)
                ->where('reference_type', DeliveryNote::class)
                ->pluck('reference_id');

            $invoiceIds = ModelConnection::where('model_type', SalesOrder::class)
                ->where('model_id', $salesOrder->id)
                ->where('reference_type', SalesInvoice::class)
                ->pluck('reference_id');

            $syncLog = [];

            foreach ($salesOrder->items as $soItem) {
                $invItems = SalesInvoiceItem::whereIn('sales_invoice_id', $invoiceIds)
                    ->where('sales_order_item_id', $soItem->id)->get();

                $delItems = DeliveryNoteItem::whereIn('delivery_note_id', $deliveryIds)
                    ->where('referenceable_type', SalesOrderItem::class)
                    ->where('referenceable_id', $soItem->id)->get();

                if ($invItems->isEmpty() && $delItems->isEmpty()) {
                    continue;
                }

                $groups = collect();

                foreach ($invItems as $ii) {
                    $key      = "{$ii->price}|{$ii->tax_id}|{$ii->tax_rate}|{$soItem->source_warehouse_id}";
                    $existing = $groups->get($key, [
                        'qty'                      => 0,
                        'price'                    => $ii->price,
                        'tax_id'                   => $ii->tax_id,
                        'tax_rate'                 => $ii->tax_rate,
                        'warehouse_id'             => $soItem->source_warehouse_id,
                        'source_invoice_item_ids'  => [],
                        'source_delivery_item_ids' => [],
                    ]);
                    $existing['qty'] += $ii->quantity;
                    $existing['source_invoice_item_ids'][] = $ii->id;
                    $groups->put($key, $existing);
                }

                foreach ($delItems as $di) {
                    $wh       = $di->source_warehouse_id ?? $soItem->source_warehouse_id;
                    $key      = "{$soItem->price}|{$soItem->tax_id}|{$soItem->tax_rate}|{$wh}";
                    $existing = $groups->get($key, [
                        'qty'                      => 0,
                        'price'                    => $soItem->price,
                        'tax_id'                   => $soItem->tax_id,
                        'tax_rate'                 => $soItem->tax_rate,
                        'warehouse_id'             => $wh,
                        'source_invoice_item_ids'  => [],
                        'source_delivery_item_ids' => [],
                    ]);
                    $existing['qty'] += $di->quantity;
                    $existing['source_delivery_item_ids'][] = $di->id;
                    $groups->put($key, $existing);
                }

                if ($groups->isEmpty()) {
                    continue;
                }

                if ($groups->count() === 1) {
                    $g = $groups->first();
                    $soItem->update([
                        'price'               => $g['price'],
                        'tax_id'              => $g['tax_id'],
                        'tax_rate'            => $g['tax_rate'],
                        'source_warehouse_id' => $g['warehouse_id'],
                        'basic_amount'        => $soItem->quantity * $g['price'],
                    ]);
                    $soItem->refresh();
                    $syncLog[] = ['action' => 'update', 'so_item_id' => $soItem->id, 'price' => $g['price']];
                } else {
                    $parentId = $soItem->id;
                    $soItem->delete();

                    foreach ($groups as $g) {
                        $newItem = $soItem->replicate()->fill([
                            'quantity'            => $g['qty'],
                            'price'               => $g['price'],
                            'tax_id'              => $g['tax_id'],
                            'tax_rate'            => $g['tax_rate'],
                            'source_warehouse_id' => $g['warehouse_id'],
                            'delivered_quantity'  => 0,
                            'billed_quantity'     => 0,
                            'parent_item_id'      => $parentId,
                            'basic_amount'        => $g['qty'] * $g['price'],
                        ]);
                        $newItem->id = (string) Str::ulid();
                        $newItem->save();
                        $newItem->refresh();

                        $newDelivered = empty($g['source_delivery_item_ids']) ? 0
                            : DeliveryNoteItem::whereIn('id', $g['source_delivery_item_ids'])->sum('quantity');
                        $newBilled = empty($g['source_invoice_item_ids']) ? 0
                            : SalesInvoiceItem::whereIn('id', $g['source_invoice_item_ids'])->sum('quantity');
                        $newItem->update([
                            'delivered_quantity' => $newDelivered,
                            'billed_quantity'    => $newBilled,
                        ]);

                        $syncLog[] = [
                            'action'              => 'split',
                            'original_so_item_id' => $parentId,
                            'new_so_item_id'      => $newItem->id,
                            'price'               => $g['price'],
                            'qty'                 => $g['qty'],
                        ];
                    }
                }
            }

            $salesOrder->load('items');
            $totals = $this->applyDiscountToItems($salesOrder, $salesOrder->items);
            $salesOrder->update([
                'amount' => $totals['basic_amount'] + $totals['tax_amount'],
            ]);

            $this->updateSalesOrderStatus($salesOrder);

            ModelConnection::create([
                'model_type'     => SalesOrder::class,
                'model_id'       => $salesOrder->id,
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

    public function markDone(SalesOrder $salesOrder): array {
        return DB::transaction(function () use ($salesOrder) {
            $salesOrder->items()->lockForUpdate()->get();

            $deliveryIds = ModelConnection::where('model_type', SalesOrder::class)
                ->where('model_id', $salesOrder->id)
                ->where('reference_type', DeliveryNote::class)
                ->pluck('reference_id');

            $invoiceIds = ModelConnection::where('model_type', SalesOrder::class)
                ->where('model_id', $salesOrder->id)
                ->where('reference_type', SalesInvoice::class)
                ->pluck('reference_id');

            $mismatches = [];
            foreach ($salesOrder->items as $soItem) {
                $deliveredQty = DeliveryNoteItem::whereIn('delivery_note_id', $deliveryIds)
                    ->where('referenceable_type', SalesOrderItem::class)
                    ->where('referenceable_id', $soItem->id)
                    ->sum('quantity');

                $billedQty = SalesInvoiceItem::whereIn('sales_invoice_id', $invoiceIds)
                    ->where('sales_order_item_id', $soItem->id)
                    ->sum('quantity');

                if ((float) $deliveredQty !== (float) $billedQty) {
                    $mismatches[] = [
                        'item_name'     => $soItem->item?->name,
                        'delivered_qty' => $deliveredQty,
                        'billed_qty'    => $billedQty,
                    ];
                }
            }

            if (! empty($mismatches)) {
                throw ValidationException::withMessages(['mismatches' => $mismatches]);
            }

            $syncLog = $this->syncItems($salesOrder);

            $salesOrder->update([
                'status' => Utils::replaceStatus($salesOrder->status, [
                    FormStatus::TO_DELIVER,
                    FormStatus::PARTIALLY_DELIVERED,
                    FormStatus::DELIVERED,
                    FormStatus::OVER_DELIVERED,
                    FormStatus::TO_BILL,
                    FormStatus::PARTIALLY_BILLED,
                    FormStatus::BILLED,
                    FormStatus::OVER_BILLED,
                ], FormStatus::COMPLETED),
            ]);

            ModelConnection::create([
                'model_type'     => SalesOrder::class,
                'model_id'       => $salesOrder->id,
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

    private function rollbackItems(SalesOrder $salesOrder) {
        if ($salesOrder->referenceable_type && $salesOrder->referenceable_id) {
            $additionalData          = $salesOrder->referenceable->additional_data ?? [];
            $additionalData['order'] = false;
            $salesOrder->referenceable->update(['additional_data' => $additionalData]);
        }
        $items = $salesOrder->items()
            ->get();
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
        $validatedItems = [];
        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            $stock    = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;

            $validatedItems[] = [
                'itemVariantId' => $item->item_id,
                'warehouseId'   => $item->source_warehouse_id,
                'quantity'      => $quantity,
            ];
        }

        if (\count($validatedItems) > 0) {
            event(new StockReservationChanged($salesOrder, 'decrement', 'reservations', $validatedItems));
        }
    }

    public function onRejected(Model $salesOrder): mixed {
        DB::beginTransaction();
        $salesOrder->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        $this->rollbackItems($salesOrder);

        DB::commit();

        return $salesOrder;
    }

    public function cancel(Model $salesOrder): mixed {
        DB::beginTransaction();
        $salesOrder->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        $this->rollbackItems($salesOrder);

        DB::commit();

        return $salesOrder;
    }
}
