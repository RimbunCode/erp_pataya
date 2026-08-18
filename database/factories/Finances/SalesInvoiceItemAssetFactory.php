<?php

namespace Database\Factories\Finances;

use App\Models\Asset\Asset;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\SalesInvoiceItemAsset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesInvoiceItemAsset>
 */
class SalesInvoiceItemAssetFactory extends Factory {
    protected $model = SalesInvoiceItemAsset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'sales_invoice_item_id' => SalesInvoiceItem::factory(),
            'asset_id'              => Asset::factory(),
            'quantity'              => 1,
        ];
    }
}
