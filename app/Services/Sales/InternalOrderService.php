<?php

namespace App\Services\Sales;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Sales\InternalOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class InternalOrderService {
    private function fillRelations(array $data) {
        return $data;
    }

    private function fillItemRelations(array $data, array $units = []) {
        $unit                        = $units[$data['unit']['id']] ?? null;
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $data['source_warehouse_id'] = $data['source_warehouse']['id'] ?? null;

        return $data;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data) {
        $data['code']  = FormatingSeries::generate(InternalOrder::class, $data, true);
        $internalOrder = InternalOrder::create($this->fillRelations($data));
        $units         = $this->batchLoadUnits($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);
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
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $internalOrder->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units = $this->batchLoadUnits($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);

            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

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

        $items  = $internalOrder->items()->with(['item'])->get();
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");
        $errorItems = [];

        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            $stock    = $stocks->get($stockKey);

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
        $items  = $internalOrder->items()->get();
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => "{$stock->item_variant_id}-{$stock->warehouse_id}");

        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            $stock    = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

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
