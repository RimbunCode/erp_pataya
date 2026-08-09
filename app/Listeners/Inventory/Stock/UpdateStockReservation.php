<?php

namespace App\Listeners\Inventory\Stock;

use App\Events\Inventory\StockReservationChanged;
use App\Models\Inventory\Stock;

class UpdateStockReservation {
    public function handle(StockReservationChanged $event): void {
        $stocks = Stock::whereIn('item_variant_id', collect($event->items)->pluck('itemVariantId'))
            ->whereIn('warehouse_id', collect($event->items)->pluck('warehouseId'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($s) => "{$s->item_variant_id}-{$s->warehouse_id}");

        foreach ($event->items as $item) {
            $stock = $stocks->get("{$item['itemVariantId']}-{$item['warehouseId']}");
            if (! $stock) {
                throw new \RuntimeException("Stock not found for item {$item['itemVariantId']} in warehouse {$item['warehouseId']}");
            }
            $stock->updateDetails($event->operator, $event->type, $event->document->code, $item['quantity']);
        }
    }
}
