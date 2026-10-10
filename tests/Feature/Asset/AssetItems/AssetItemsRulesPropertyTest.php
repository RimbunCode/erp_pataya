<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Membership and legacy-payload properties for direct asset_id rows.
 */
class AssetItemsRulesPropertyTest extends TestCase {
    private const ITERATIONS = 60;

    #[Test]
    public function membership_is_accepted_iff_asset_id_matches_its_bucket(): void {
        mt_srand(3003);

        for ($iteration = 0; $iteration < self::ITERATIONS; $iteration++) {
            $buckets  = ['items' => [], 'asset_items' => []];
            $expected = [];

            foreach (['items', 'asset_items'] as $bucket) {
                for ($i = 0, $count = mt_rand(0, 5); $i < $count; $i++) {
                    $isAsset            = (bool) mt_rand(0, 1);
                    $buckets[$bucket][] = $isAsset
                        ? ['asset' => ['id' => "asset-{$iteration}-{$bucket}-{$i}"]]
                        : ['item' => ['id' => "variant-{$iteration}-{$bucket}-{$i}"], 'asset' => null];

                    if (($bucket === 'items' && $isAsset) || ($bucket === 'asset_items' && ! $isAsset)) {
                        $expected[] = "{$bucket}.{$i}.asset";
                    }
                }
            }

            $validator = ValidatorFacade::make([], []);
            AssetItemsRules::validateMembership(
                $validator,
                $buckets,
                fn (array $rows) => array_map(fn ($row) => $row['asset']['id'] ?? null, $rows),
                'asset',
            );

            $actual = array_keys($validator->errors()->toArray());
            sort($actual);
            sort($expected);

            $this->assertSame($expected, $actual, "iteration {$iteration}");
        }
    }

    #[Test]
    public function legacy_asset_lines_are_rejected_exactly_when_the_key_exists(): void {
        mt_srand(8008);

        for ($iteration = 0; $iteration < self::ITERATIONS; $iteration++) {
            $buckets  = ['items' => [], 'asset_items' => []];
            $expected = [];

            foreach (['items', 'asset_items'] as $bucket) {
                for ($i = 0, $count = mt_rand(0, 6); $i < $count; $i++) {
                    $hasLegacyKey       = (bool) mt_rand(0, 1);
                    $buckets[$bucket][] = $hasLegacyKey
                        ? ['id' => "{$bucket}-{$i}", 'asset_lines' => mt_rand(0, 1) ? [] : null]
                        : ['id' => "{$bucket}-{$i}"];

                    if ($hasLegacyKey) {
                        $expected[] = "{$bucket}.{$i}.asset_lines";
                    }
                }
            }

            $validator = ValidatorFacade::make([], []);
            AssetItemsRules::rejectLegacyAssetLines($validator, $buckets);

            $actual = array_keys($validator->errors()->toArray());
            sort($actual);
            sort($expected);

            $this->assertSame($expected, $actual, "iteration {$iteration}");
        }
    }
}
