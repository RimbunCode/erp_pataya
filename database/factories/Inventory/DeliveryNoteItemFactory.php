<?php

namespace Database\Factories\Inventory;

use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\SalesOrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryNoteItem>
 */
class DeliveryNoteItemFactory extends Factory {
    protected $model = DeliveryNoteItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $deliveryNote   = DeliveryNote::factory()->create();
        $salesOrderItem = SalesOrderItem::create([
            'sales_order_id' => $deliveryNote->referenceable_id,
            'item_id'        => ItemVariant::factory()->create()->id,
            'quantity'       => 1,
            'price'          => 0,
        ]);

        return [
            'delivery_note_id'   => $deliveryNote->id,
            'item_id'            => ItemVariant::factory(),
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $salesOrderItem->id,
            'quantity'           => 1,
            'valuation_rates'    => [],
        ];
    }
}
