<?php

namespace Database\Factories\Finances;

use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\ItemVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesInvoiceItem>
 */
class SalesInvoiceItemFactory extends Factory {
    protected $model = SalesInvoiceItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'sales_invoice_id' => SalesInvoice::factory(),
            'item_id'          => ItemVariant::factory(),
            'quantity'         => 1,
            'price'            => 0,
        ];
    }
}
