<?php

namespace App\Services\Sales;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Inventory\StockReservationChanged;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Model;
use App\Models\Sales\InternalOrder;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class InternalOrderService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        return $data;
    }

    private function fillItemRelations(array $data, array $units = []) {
        $unit                        = $units[$data['unit']['id']] ?? null;
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $unit?->conversion_factor ?? 1;
        $data['source_warehouse_id'] = $data['source_warehouse']['id'] ?? null;

        // Requirement 1, spec asset-service-internal-order: baris referenceable
        // ke AssetService/AssetServiceConsumedItem (opsional) — TIDAK mengubah
        // logic ItemVariant existing di atas, cuma cabang baru untuk field baru.
        if (! empty($data['referenceable']['type']) && ! empty($data['referenceable']['id'])) {
            $data['referenceable_type'] = $data['referenceable']['type'];
            $data['referenceable_id']   = $data['referenceable']['id'];
        }

        return $data;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data): Model {
        $data['code']  = FormatingSeries::generate(InternalOrder::class, $data, true);
        $internalOrder = InternalOrder::create($this->fillRelations($data));
        $units         = $this->batchLoadUnits($data);
        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);
            $internalOrder->items()->create($item);
        }

        return $internalOrder;
    }

    public function update(Model $internalOrder, array $data): Model {
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

        return $internalOrder;
    }

    public function submit(Model $internalOrder): mixed {
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
        $errorItems     = [];
        $validatedItems = [];

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

            $validatedItems[] = [
                'itemVariantId' => $item->item_id,
                'warehouseId'   => $item->source_warehouse_id,
                'quantity'      => $quantity,
            ];
        }

        if (count($errorItems) > 0) {
            DB::rollBack();
            throw ValidationException::withMessages([
                'items' => $errorItems,
            ]);
        }

        if (\count($validatedItems) > 0) {
            event(new StockReservationChanged($internalOrder, 'increment', 'reservations', $validatedItems));
        }

        DB::commit();
        $internalOrder->checkApproval();

        return $internalOrder;
    }

    public function updateInternalOrderStatus(InternalOrder $internalOrder): void {
        $undeliveredItems = $internalOrder->items()
            ->leftJoin('item_variants', 'item_variants.id', '=', 'internal_order_items.item_id')
            ->where('is_stock_item', true)
            ->select(['undelivered_quantity', 'quantity'])->get();
        $countUndeliveredItems = $undeliveredItems->sum('undelivered_quantity');
        $sumQuantity           = $undeliveredItems->sum('quantity');
        if ($countUndeliveredItems == $sumQuantity) {
            $status = Utils::replaceStatus(
                $internalOrder->status,
                [FormStatus::DELIVERED, FormStatus::PARTIALLY_DELIVERED],
                FormStatus::TO_DELIVER,
            );
        } elseif ($countUndeliveredItems > 0) {
            $status = Utils::replaceStatus(
                $internalOrder->status,
                FormStatus::TO_DELIVER,
                FormStatus::PARTIALLY_DELIVERED,
            );
        } else {
            $status = Utils::replaceStatus(
                $internalOrder->status,
                [FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED],
                FormStatus::DELIVERED,
            );
        }

        $internalOrder->update(['status' => $status]);
    }

    public function onApproved(Model $internalOrder): mixed {
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

        $validatedItems = [];
        foreach ($items as $item) {
            $stockKey = "{$item->item_id}-{$item->source_warehouse_id}";
            $stock    = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity         = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $validatedItems[] = [
                'itemVariantId' => $item->item_id,
                'warehouseId'   => $item->source_warehouse_id,
                'quantity'      => $quantity,
            ];
        }

        if (\count($validatedItems) > 0) {
            event(new StockReservationChanged($internalOrder, 'decrement', 'reservations', $validatedItems));
        }
    }

    public function onRejected(Model $internalOrder): mixed {
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

    public function cancel(Model $internalOrder): mixed {
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

    public function amend(Model $model): mixed {
        return $model;
    }
}
