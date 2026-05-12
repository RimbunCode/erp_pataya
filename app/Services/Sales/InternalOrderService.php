<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Stock;
use App\Models\Sales\InternalOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class InternalOrderService {
    private function fillRelations(array $data) {
        return $data;
    }

    private function fillItemRelations(array $data) {
        $data['item_id']             = $data['item']['id'];
        $data['unit_id']             = $data['unit']['unit_id'];
        $data['conversion_factor']   = $data['unit']['conversion_factor'];
        $data['source_warehouse_id'] = $data['source_warehouse']['id'];

        return $data;
    }

    public function create(array $data) {
        $data['code']  = FormatingSeries::generate(InternalOrder::class, $data, true);
        $internalOrder = InternalOrder::create($this->fillRelations($data));
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);
            $internalOrder->items()->create($item);
        }
        $internalOrder->logForCreated();

        return $internalOrder;
    }

    public function update(InternalOrder $internalOrder, array $data) {
        $internalOrder->fillForUpdate($this->fillRelations($data));

        $internalOrder->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->delete();

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);

            if (Ulid::isValid($item['id'])) {
                $internalOrder->items()->find($item['id'])->update($item);

                continue;
            }

            $internalOrder->items()->create($item);
        }

        $internalOrder->logForUpdated();

        return $internalOrder;
    }

    public function submit(InternalOrder $internalOrder) {
        DB::beginTransaction();

        $internalOrder->update([
            'code' => FormatingSeries::generate(InternalOrder::class, $internalOrder),
        ]);

        $items      = $internalOrder->items()->with(['item'])->get();
        $errorItems = [];

        foreach ($items as $item) {
            $stock = Stock::lockForUpdate()
                ->where('item_variant_id', $item->item_id)
                ->where('warehouse_id', $item->source_warehouse_id)
                ->first();

            if (! $stock) {
                $errorItems[] = "Item {$item->item->name} not found in source warehouse";

                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;

            if ($stock->ready_quantity < $quantity) {
                $errorItems[] = "Item {$item->item->name} stock {$stock->ready_quantity}, need {$quantity}";

                continue;
            }

            // sama pola dengan SalesOrder
            $stock->updateDetails('increment', 'reservations', $internalOrder->code, $quantity);
        }

        if (count($errorItems) > 0) {
            DB::rollBack();
            throw ValidationException::withMessages([
                'items' => $errorItems,
            ]);
        }

        DB::commit();
        $internalOrder->checkApproval();

        return $internalOrder;
    }

    public function onApproved(InternalOrder $internalOrder) {
        $internalOrder->update([
            'status' => [
                FormStatus::TO_DELIVER,
            ],
        ]);

        return $internalOrder;
    }

    private function rollbackItems(InternalOrder $internalOrder) {
        $items = $internalOrder->items()->get();

        foreach ($items as $item) {
            $stock = Stock::lockForUpdate()
                ->where('item_variant_id', $item->item_id)
                ->where('warehouse_id', $item->source_warehouse_id)
                ->first();

            $stock->updateDetails('decrement', 'reservations', $internalOrder->code);
        }
    }

    public function onRejected(InternalOrder $internalOrder) {
        DB::beginTransaction();

        $internalOrder->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        $this->rollbackItems($internalOrder);

        DB::commit();

        return $internalOrder;
    }

    public function cancel(InternalOrder $internalOrder) {
        DB::beginTransaction();

        $internalOrder->update([
            'status' => [
                FormStatus::CANCELED,
            ],
        ]);

        $this->rollbackItems($internalOrder);

        DB::commit();

        return $internalOrder;
    }
}
