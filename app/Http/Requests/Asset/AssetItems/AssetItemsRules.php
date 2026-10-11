<?php

namespace App\Http\Requests\Asset\AssetItems;

use Illuminate\Contracts\Validation\Validator;

final class AssetItemsRules {
    /**
     * @param  array<string,array<int|string,mixed>>  $buckets
     * @param  callable(array<int|string,mixed>):array<int|string,?string>  $assetIdsOf
     */
    public static function validateMembership(Validator $validator, array $buckets, callable $assetIdsOf, string $rowErrorField): void {
        foreach ($buckets as $bucket => $rows) {
            $assetIds = $assetIdsOf($rows);
            foreach ($rows as $index => $row) {
                $isAsset = filled($assetIds[$index] ?? null);
                if ($bucket === 'items' && $isAsset) {
                    $validator->errors()->add("items.{$index}.{$rowErrorField}", __('asset/asset.item_must_be_regular'));
                } elseif ($bucket === 'asset_items' && ! $isAsset) {
                    $validator->errors()->add("asset_items.{$index}.{$rowErrorField}", __('asset/asset.item_must_be_fixed_asset'));
                }
            }
        }
    }

    /** @param array<string,array<int|string,mixed>> $buckets */
    public static function validateCombinedMinimum(Validator $validator, array $buckets): void {
        if (count($buckets['items']) + count($buckets['asset_items']) === 0) {
            $validator->errors()->add('items', __('validation.required', ['attribute' => 'items']));
        }
    }

    /** @param array<string,array<int|string,mixed>> $buckets */
    public static function rejectLegacyAssetLines(Validator $validator, array $buckets): void {
        foreach ($buckets as $bucket => $rows) {
            foreach ($rows as $index => $row) {
                if (array_key_exists('asset_lines', $row)) {
                    $validator->errors()->add("{$bucket}.{$index}.asset_lines", __('asset/asset.asset_lines_moved'));
                }
            }
        }
    }
}
