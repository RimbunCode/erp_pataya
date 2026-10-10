<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Models\Sales\SalesOrderItem;
use App\Services\Asset\AssetItems\AssetItemPartitioner;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Property 1 dan 2, spec asset-items-section — partisi adalah penutup disjoint
 * dan round-trip partisi + mergePayload menghasilkan permutasi input. Generator
 * manual dengan seed tetap supaya kegagalan reprodusibel.
 */
class AssetItemPartitionerPropertyTest extends TestCase {
    private const ITERATIONS = 60;

    protected function setUp(): void {
        parent::setUp();
    }

    /**
     * @return list<SalesOrderItem>
     */
    private function randomRows(int $count): array {
        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $hasAsset = (bool) mt_rand(0, 1);
            $rows[]   = (new SalesOrderItem)->forceFill([
                'id'       => 'row-' . $i,
                'item_id'  => $hasAsset ? null : 'variant-' . $i,
                'asset_id' => $hasAsset ? 'asset-' . $i : null,
            ]);
        }

        return $rows;
    }

    #[Test]
    public function property_1_partition_is_a_disjoint_cover_that_respects_flags_and_order(): void {
        mt_srand(20260926);
        $partitioner = new AssetItemPartitioner;

        for ($iteration = 0; $iteration < self::ITERATIONS; $iteration++) {
            $rows  = $this->randomRows(mt_rand(0, 12));
            $parts = $partitioner->partition(collect($rows));

            $regularIds = $parts['items']->pluck('id')->all();
            $assetIds   = $parts['asset_items']->pluck('id')->all();
            $inputIds   = array_map(fn ($row) => $row->id, $rows);

            $this->assertSame([], array_intersect($regularIds, $assetIds), "iterasi {$iteration}: bucket harus saling lepas");

            $union = array_merge($regularIds, $assetIds);
            sort($union);
            $expected = $inputIds;
            sort($expected);
            $this->assertSame($expected, $union, "iterasi {$iteration}: gabungan harus sama dengan input");

            foreach ($parts['items'] as $row) {
                $this->assertNull($row->asset_id, "iterasi {$iteration}: items berisi asset_id");
            }
            foreach ($parts['asset_items'] as $row) {
                $this->assertNotNull($row->asset_id, "iterasi {$iteration}: asset_items tidak memiliki asset_id");
            }

            $this->assertSame(
                array_values(array_filter($inputIds, fn ($id) => \in_array($id, $regularIds, true))),
                $regularIds,
                "iterasi {$iteration}: urutan relatif items berubah",
            );
            $this->assertSame(
                array_values(array_filter($inputIds, fn ($id) => \in_array($id, $assetIds, true))),
                $assetIds,
                "iterasi {$iteration}: urutan relatif asset_items berubah",
            );
        }
    }

    #[Test]
    public function property_2_merge_of_partition_is_a_permutation_and_merge_is_idempotent(): void {
        mt_srand(926);
        $partitioner = new AssetItemPartitioner;

        for ($iteration = 0; $iteration < self::ITERATIONS; $iteration++) {
            $rows  = $this->randomRows(mt_rand(1, 12));
            $parts = $partitioner->partition(collect($rows));

            $payload = [
                'items'       => $parts['items']->map(fn ($row) => ['id' => $row->id])->all(),
                'asset_items' => $parts['asset_items']->map(fn ($row) => ['id' => $row->id])->all(),
            ];

            $merged = AssetItemPartitioner::mergePayload($payload);

            $mergedIds = array_column($merged['items'], 'id');
            $inputIds  = array_map(fn ($row) => $row->id, $rows);
            sort($mergedIds);
            sort($inputIds);

            $this->assertSame($inputIds, $mergedIds, "iterasi {$iteration}: merge bukan permutasi input");
            $this->assertSame($merged, AssetItemPartitioner::mergePayload($merged), "iterasi {$iteration}: merge tidak idempoten");
        }
    }
}
