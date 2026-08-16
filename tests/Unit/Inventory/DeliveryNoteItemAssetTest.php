<?php

namespace Tests\Unit\Inventory;

use App\Models\Asset\Asset;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\DeliveryNoteItemAsset;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DeliveryNoteItemAssetTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function delivery_note_item_returns_belongs_to_relation(): void {
        $line = new DeliveryNoteItemAsset;

        $this->assertInstanceOf(BelongsTo::class, $line->deliveryNoteItem());
        $this->assertInstanceOf(DeliveryNoteItem::class, $line->deliveryNoteItem()->getRelated());
    }

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $line = new DeliveryNoteItemAsset;

        $this->assertInstanceOf(BelongsTo::class, $line->asset());
        $this->assertInstanceOf(Asset::class, $line->asset()->getRelated());
    }

    #[Test]
    public function delivery_note_item_asset_lines_returns_has_many_relation(): void {
        $item = new DeliveryNoteItem;

        $this->assertInstanceOf(HasMany::class, $item->assetLines());
        $this->assertInstanceOf(DeliveryNoteItemAsset::class, $item->assetLines()->getRelated());
    }
}
