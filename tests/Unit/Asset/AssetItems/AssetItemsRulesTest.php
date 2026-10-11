<?php

namespace Tests\Unit\Asset\AssetItems;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetItemsRulesTest extends TestCase {
    #[Test]
    public function reject_legacy_asset_lines_rejects_the_old_key_in_both_buckets_even_when_empty(): void {
        $validator = ValidatorFacade::make([], []);

        AssetItemsRules::rejectLegacyAssetLines($validator, [
            'items' => [
                ['id' => 'a'],
                ['id' => 'b', 'asset_lines' => []],
            ],
            'asset_items' => [
                ['id' => 'c', 'asset_lines' => null],
            ],
        ]);

        $this->assertSame(
            ['items.1.asset_lines', 'asset_items.0.asset_lines'],
            array_keys($validator->errors()->toArray()),
        );
    }

    #[Test]
    public function combined_minimum_fails_only_when_both_lists_are_empty(): void {
        $bothEmpty = ValidatorFacade::make([], []);
        AssetItemsRules::validateCombinedMinimum($bothEmpty, ['items' => [], 'asset_items' => []]);
        $this->assertArrayHasKey('items', $bothEmpty->errors()->toArray());

        $onlyAssets = ValidatorFacade::make([], []);
        AssetItemsRules::validateCombinedMinimum($onlyAssets, ['items' => [], 'asset_items' => [['id' => 'x']]]);
        $this->assertTrue($onlyAssets->errors()->isEmpty());

        $onlyItems = ValidatorFacade::make([], []);
        AssetItemsRules::validateCombinedMinimum($onlyItems, ['items' => [['id' => 'x']], 'asset_items' => []]);
        $this->assertTrue($onlyItems->errors()->isEmpty());
    }
}
