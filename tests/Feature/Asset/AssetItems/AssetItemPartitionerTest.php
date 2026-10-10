<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Services\Asset\AssetItems\AssetItemPartitioner;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Partisi baris dokumen berdasarkan asset_id yang terisi pada row.
 */
class AssetItemPartitionerTest extends TestCase {
    private AssetItemPartitioner $partitioner;

    protected function setUp(): void {
        parent::setUp();

        $this->partitioner = new AssetItemPartitioner;

    }

    private function row(?string $assetId, string $marker): SalesOrderItem {
        return (new SalesOrderItem)->forceFill([
            'id'       => $marker,
            'item_id'  => $assetId === null ? 'variant-' . $marker : null,
            'asset_id' => $assetId,
        ]);
    }

    #[Test]
    public function partition_splits_rows_and_preserves_order_inside_each_bucket(): void {
        $rows = collect([
            $this->row(null, 'r1'),
            $this->row('asset-a', 'a1'),
            $this->row(null, 'r2'),
            $this->row('asset-b', 'a2'),
        ]);

        $parts = $this->partitioner->partition($rows);

        $this->assertSame(['r1', 'r2'], $parts['items']->pluck('id')->all());
        $this->assertSame(['a1', 'a2'], $parts['asset_items']->pluck('id')->all());
    }

    #[Test]
    public function partition_treats_rows_without_a_known_variant_as_regular(): void {
        $rows = collect([
            $this->row(null, 'regular'),
            (new SalesOrderItem)->forceFill(['id' => 'nullrow', 'item_id' => null, 'asset_id' => null]),
        ]);

        $parts = $this->partitioner->partition($rows);

        $this->assertCount(2, $parts['items']);
        $this->assertCount(0, $parts['asset_items']);
    }

    #[Test]
    public function partition_of_an_empty_collection_returns_two_empty_buckets(): void {
        $parts = $this->partitioner->partition(collect());

        $this->assertTrue($parts['items']->isEmpty());
        $this->assertTrue($parts['asset_items']->isEmpty());
    }

    #[Test]
    public function partition_arrays_uses_the_closure_to_find_asset_id(): void {
        $rows = [
            ['id' => 'r1', 'item' => ['id' => 'variant-r1']],
            ['id' => 'a1', 'asset' => ['id' => 'asset-a']],
            ['id' => 'none'],
        ];

        $parts = $this->partitioner->partitionArrays($rows, fn (array $row) => $row['asset']['id'] ?? null);

        $this->assertSame(['r1', 'none'], array_column($parts['items'], 'id'));
        $this->assertSame(['a1'], array_column($parts['asset_items'], 'id'));
    }

    #[Test]
    public function partition_arrays_accepts_a_collection_of_arrays(): void {
        $parts = $this->partitioner->partitionArrays(
            collect([['asset_id' => 'asset-a']]),
            fn (array $row) => $row['asset_id'],
        );

        $this->assertCount(0, $parts['items']);
        $this->assertCount(1, $parts['asset_items']);
    }

    #[Test]
    public function apply_replaces_items_relation_and_exposes_asset_items_in_the_serialized_document(): void {
        $document = new SalesOrder;
        $document->setRelation('items', collect([
            $this->row(null, 'r1'),
            $this->row('asset-a', 'a1'),
        ]));

        $this->partitioner->apply($document);

        $this->assertSame(['r1'], $document->items->pluck('id')->all());
        $this->assertSame(['a1'], $document->assetItems->pluck('id')->all());

        $array = $document->toArray();
        $this->assertSame(['r1'], array_column($array['items'], 'id'));
        $this->assertSame(['a1'], array_column($array['asset_items'], 'id'));
    }
}
