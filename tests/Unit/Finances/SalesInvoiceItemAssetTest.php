<?php

namespace Tests\Unit\Finances;

use App\Models\Asset\Asset;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\SalesInvoiceItemAsset;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SalesInvoiceItemAssetTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function sales_invoice_item_returns_belongs_to_relation(): void {
        $line = new SalesInvoiceItemAsset;

        $this->assertInstanceOf(BelongsTo::class, $line->salesInvoiceItem());
        $this->assertInstanceOf(SalesInvoiceItem::class, $line->salesInvoiceItem()->getRelated());
    }

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $line = new SalesInvoiceItemAsset;

        $this->assertInstanceOf(BelongsTo::class, $line->asset());
        $this->assertInstanceOf(Asset::class, $line->asset()->getRelated());
    }

    #[Test]
    public function sales_invoice_item_asset_lines_returns_has_many_relation(): void {
        $item = new SalesInvoiceItem;

        $this->assertInstanceOf(HasMany::class, $item->assetLines());
        $this->assertInstanceOf(SalesInvoiceItemAsset::class, $item->assetLines()->getRelated());
    }
}
