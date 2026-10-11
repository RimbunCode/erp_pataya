<?php

namespace Tests\Unit\Asset\AssetItems;

use App\Services\Asset\AssetItems\AssetItemPartitioner;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Requirement 7.1, spec asset-items-section: mergePayload menggabungkan `items` +
 * `asset_items` di satu titik. Fungsi murni, tidak butuh database.
 */
class AssetItemPartitionerMergePayloadTest extends TestCase {
    #[Test]
    public function payload_without_asset_items_is_returned_unchanged(): void {
        $data = ['date' => '2026-01-01', 'items' => [['id' => 'a'], ['id' => 'b']]];

        $this->assertSame($data, AssetItemPartitioner::mergePayload($data));
    }

    #[Test]
    public function empty_asset_items_key_is_dropped_and_items_are_untouched(): void {
        $result = AssetItemPartitioner::mergePayload([
            'items'       => [['id' => 'a']],
            'asset_items' => [],
        ]);

        $this->assertSame(['items' => [['id' => 'a']]], $result);
    }

    #[Test]
    public function asset_items_are_appended_after_items_in_order(): void {
        $result = AssetItemPartitioner::mergePayload([
            'items'       => [['id' => 'a'], ['id' => 'b']],
            'asset_items' => [['id' => 'x'], ['id' => 'y']],
        ]);

        $this->assertArrayNotHasKey('asset_items', $result);
        $this->assertSame(['a', 'b', 'x', 'y'], array_column($result['items'], 'id'));
    }

    #[Test]
    public function only_asset_items_produces_items_key(): void {
        $result = AssetItemPartitioner::mergePayload([
            'asset_items' => [['id' => 'x']],
        ]);

        $this->assertSame([['id' => 'x']], $result['items']);
    }

    #[Test]
    public function null_items_with_asset_items_is_treated_as_empty_list(): void {
        $result = AssetItemPartitioner::mergePayload([
            'items'       => null,
            'asset_items' => [['id' => 'x']],
        ]);

        $this->assertSame([['id' => 'x']], $result['items']);
    }

    #[Test]
    public function other_keys_are_not_touched(): void {
        $result = AssetItemPartitioner::mergePayload([
            'code'              => 'X',
            'payment_schedules' => [['id' => 'p']],
            'items'             => [['id' => 'a']],
            'asset_items'       => [['id' => 'x']],
        ]);

        $this->assertSame('X', $result['code']);
        $this->assertSame([['id' => 'p']], $result['payment_schedules']);
    }

    #[Test]
    public function merge_is_idempotent(): void {
        $data = [
            'items'       => [['id' => 'a']],
            'asset_items' => [['id' => 'x']],
        ];

        $once  = AssetItemPartitioner::mergePayload($data);
        $twice = AssetItemPartitioner::mergePayload($once);

        $this->assertSame($once, $twice);
    }

    #[Test]
    public function non_list_asset_items_keys_are_reindexed(): void {
        $result = AssetItemPartitioner::mergePayload([
            'items'       => [['id' => 'a']],
            'asset_items' => [5 => ['id' => 'x'], 9 => ['id' => 'y']],
        ]);

        $this->assertSame([0, 1, 2], array_keys($result['items']));
    }
}
