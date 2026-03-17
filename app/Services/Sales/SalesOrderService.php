<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Core\Preference;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Sales\SalesOrder;
use App\Utils;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class SalesOrderService {
    private function fillRelations(array $data) {
        $data['customer_id']   = $data['customer']['id'];
        $data['customer_name'] = $data['customer']['name'];

        // relasi cabang customer
        $data['customer_branch_id']   = $data['customer_branch']['id'];
        $data['customer_branch_name'] = $data['customer_branch']['name'];

        $defaultCurrency            = Preference::find('default_currency_id')->value;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        return $data;
    }

    private function fillItemRelations(array $data, SalesOrder $salesOrder) {
        // dd($data);
        $data['item_id']             = $data['item']['id'];
        $data['unit_id']             = $data['unit']['id'];
        $data['conversion_factor']   = ItemUnit::getConversionFactor($data['item']['item_id'], $data['unit_id']);
        $data['tax_id']              = $data['tax']['id'];
        $data['tax_rate']            = $data['tax']['rate'];
        $data['currency_code']       = $salesOrder->currency_code;
        $data['base_currency_code']  = $salesOrder->base_currency_code;
        $data['exchange_rate']       = $salesOrder->exchange_rate;
        $data['source_warehouse_id'] = $data['source_warehouse']['id'];

        return $data;
    }

    private function fillPaymentScheduleRelations(array $data, SalesOrder $salesOrder) {
        $data['payment_amount']     = $salesOrder->amount * ($data['invoice_portion'] / 100);
        $data['currency_code']      = $salesOrder->currency_code;
        $data['base_currency_code'] = $salesOrder->base_currency_code;
        $data['exchange_rate']      = $salesOrder->exchange_rate;
        $data['for_internal']       = false;

        $data['payment_term_id']   = $data['payment_term']['id'] ?? null;
        $data['payment_method_id'] = $data['payment_method']['id'] ?? null;

        return $data;
    }

    public function create(array $data) {
        $data['code'] = FormatingSeries::generate(SalesOrder::class, $data, true);
        $salesOrder   = SalesOrder::create($this->fillRelations($data));
        $basicAmount  = 0;
        $taxAmount    = 0;
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesOrder);
            $item = $salesOrder->items()->create($item);

            $item->refresh();
            $basicAmount += $item->basic_amount;
            $taxAmount += $item->tax_amount;
        }
        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesOrder->discount_on, $salesOrder->discount_amount);
        $salesOrder->update([
            'amount' => $totalAmount,
        ]);
        foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
            $salesOrder->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }
        $salesOrder->logForCreated();

        return $salesOrder;
    }

    public function update(SalesOrder $salesOrder, array $data) {
        $salesOrder->fillForUpdate($this->fillRelations($data), true);

        $salesOrder->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();
        $basicAmount = 0;
        $taxAmount   = 0;
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $salesOrder);

            if (Ulid::isValid($item['id'])) {
                $item = $salesOrder->items()
                    ->find($item['id'])->fill($item);
                $item->save();
            } else {
                $item = $salesOrder->items()->create($item);
            }

            $item->refresh();
            $basicAmount += $item->basic_amount;
            $taxAmount += $item->tax_amount;
        }
        $totalAmount = Utils::countAmount($basicAmount, $taxAmount, $salesOrder->discount_on, $salesOrder->discount_amount);
        $salesOrder->fill([
            'amount' => $totalAmount,
        ]);
        $salesOrder->save();

        $salesOrder->paymentSchedules()
            ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
            ->delete();
        foreach ($data['payment_schedules'] as $payment_schedule) {
            $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
            if (Ulid::isValid($payment_schedule['id'])) {
                $salesOrder->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);

                continue;
            }
            $salesOrder->paymentSchedules()->create(attributes: [
                ...$payment_schedule,
            ]);
        }

        $salesOrder->logForUpdated();

        return $salesOrder;
    }

    public function submit(SalesOrder $salesOrder) {
        DB::beginTransaction();

        $salesOrder->update([
            'code' => FormatingSeries::generate(SalesOrder::class, $salesOrder),
        ]);

        if ($salesOrder->referenceable_type && $salesOrder->referenceable_id) {
            ModelConnection::create([
                'model_type'     => $salesOrder->referenceable_type,
                'model_id'       => $salesOrder->referenceable_id,
                'reference_type' => SalesOrder::class,
                'reference_id'   => $salesOrder->id,
            ]);
            $additionalData          = $salesOrder->referenceable->additional_data ?? [];
            $additionalData['order'] = true;
            $salesOrder->referenceable->update(['additional_data' => $additionalData]);

            SalesOrder::where('referenceable_type', $salesOrder->referenceable_type)
                ->where('referenceable_id', $salesOrder->referenceable_id)
                ->whereRaw('json_overlaps(`status`, ?)', [json_encode(['draft'])])
                ->whereNot('created_by', Auth::user()->id)
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

        $isValid    = ! $salesOrder->is_rent;
        $errorItems = [];
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
                $errorItems[] = "Item {$item->item->name} in {$stock->warehouse->name} stock is {$stock->ready_quantity} but you need {$quantity}";

                continue;
            }
            $stock->updateDetails('increment', 'reservations', $salesOrder->code, $quantity);
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

        DB::commit();
        $salesOrder->checkApproval();

        return $salesOrder;
    }

    public function onApproved(SalesOrder $salesOrder) {
        $salesOrder->update([
            'status' => [
                FormStatus::TO_DELIVER,
                FormStatus::TO_BILL,
            ],
        ]);

        return $salesOrder;
    }

    private function rolllbackItems(SalesOrder $salesOrder) {
        if ($salesOrder->referenceable_type && $salesOrder->referenceable_id) {
            $additionalData          = $salesOrder->referenceable->additional_data ?? [];
            $additionalData['order'] = false;
            $salesOrder->referenceable->update(['additional_data' => $additionalData]);
        }
        $items = $salesOrder->items()
            ->get();
        foreach ($items as $item) {
            $stock = Stock::lockForUpdate()
                ->where('item_variant_id', $item->item_id)
                ->where('warehouse_id', $item->source_warehouse_id)
                ->lockForUpdate()
                ->first();

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;

            $stock->updateDetails('decrement', 'reservations', $salesOrder->code, $quantity);
        }
    }

    public function onRejected(SalesOrder $salesOrder) {
        DB::beginTransaction();
        $salesOrder->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        $this->rolllbackItems($salesOrder);

        DB::commit();

        return $salesOrder;
    }

    public function cancel(SalesOrder $salesOrder) {
        DB::beginTransaction();
        $salesOrder->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        $this->rolllbackItems($salesOrder);

        DB::commit();

        return $salesOrder;
    }
}
