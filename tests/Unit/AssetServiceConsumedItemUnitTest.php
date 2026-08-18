<?php

namespace Tests\Unit;

use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Unit;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceConsumedItemUnitTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function item_unit_returns_belongs_to_relation(): void {
        $consumedItem = new AssetServiceConsumedItem;

        $this->assertInstanceOf(BelongsTo::class, $consumedItem->itemUnit());
        $this->assertInstanceOf(ItemUnit::class, $consumedItem->itemUnit()->getRelated());
    }

    #[Test]
    public function factory_creates_consumed_item_with_item_unit_id(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();

        $this->assertNotNull($consumedItem->item_unit_id);
        $this->assertInstanceOf(ItemUnit::class, $consumedItem->itemUnit);
    }

    #[Test]
    public function backfill_query_resolves_item_unit_id_from_item_default_uom(): void {
        // Menguji query builder backfill yang dipakai migration secara
        // terisolasi (bukan insert NULL langsung — kolom sudah NOT NULL
        // setelah migration jalan di test DB, insert NULL akan gagal
        // constraint, sesuai perilaku yang diharapkan di production).
        $item = Item::factory()->create();
        $unit = Unit::create([
            'code'              => 'BF-' . fake()->unique()->numerify('#####'),
            'name'              => 'Backfill Unit',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $item->update(['default_unit_id' => $unit->id]);

        $resolvedId = DB::table('item_units')
            ->where('item_id', $item->id)
            ->where('unit_id', $item->default_unit_id)
            ->value('id');

        $this->assertSame($itemUnit->id, $resolvedId);
    }

    #[Test]
    public function backfill_query_resolves_null_for_item_without_default_unit(): void {
        $item = Item::factory()->create(); // default_unit_id null

        $resolvedId = DB::table('item_units')
            ->where('item_id', $item->id)
            ->where('unit_id', $item->default_unit_id)
            ->value('id');

        $this->assertNull($resolvedId);
    }
}
