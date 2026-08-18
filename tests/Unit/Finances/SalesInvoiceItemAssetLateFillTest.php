<?php

namespace Tests\Unit\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Models\Asset\Asset;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\SalesInvoiceItemAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SalesInvoiceItemAssetLateFillTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function dispatches_event_when_row_created_on_approved_invoice(): void {
        Event::fake([AssetSoldViaInvoice::class]);

        $invoice = SalesInvoice::factory()->create(['status' => [FormStatus::APPROVED]]);
        $item    = SalesInvoiceItem::factory()->create(['sales_invoice_id' => $invoice->id]);
        $asset   = Asset::factory()->create();

        $line = SalesInvoiceItemAsset::factory()->create([
            'sales_invoice_item_id' => $item->id,
            'asset_id'              => $asset->id,
        ]);

        Event::assertDispatched(AssetSoldViaInvoice::class, fn ($e) => $e->line->is($line));
    }

    #[Test]
    public function does_not_dispatch_event_when_invoice_still_draft(): void {
        Event::fake([AssetSoldViaInvoice::class]);

        $invoice = SalesInvoice::factory()->create(['status' => [FormStatus::DRAFT]]);
        $item    = SalesInvoiceItem::factory()->create(['sales_invoice_id' => $invoice->id]);
        $asset   = Asset::factory()->create();

        SalesInvoiceItemAsset::factory()->create([
            'sales_invoice_item_id' => $item->id,
            'asset_id'              => $asset->id,
        ]);

        Event::assertNotDispatched(AssetSoldViaInvoice::class);
    }
}
