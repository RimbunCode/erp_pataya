<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Http\Requests\Asset\AssetItems\AssetItemsRules;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Requirement 4.2, spec asset-items-section: membership mengikuti identitas langsung
 * asset_id pada setiap baris, bukan ItemVariant atau child asset_lines.
 */
class AssetItemsRulesMembershipTest extends TestCase {
    /**
     * @param  array<int|string,mixed>  $rows
     * @return array<int|string,?string>
     */
    private function assetIdsFromAssetKey(array $rows): array {
        return array_map(fn ($row) => $row['asset']['id'] ?? null, $rows);
    }

    private function membershipErrors(array $items, array $assetItems): array {
        $validator = ValidatorFacade::make([], []);

        AssetItemsRules::validateMembership(
            $validator,
            ['items' => $items, 'asset_items' => $assetItems],
            fn (array $rows) => $this->assetIdsFromAssetKey($rows),
            'asset',
        );

        return $validator->errors()->toArray();
    }

    #[Test]
    public function accepts_regular_rows_in_items_and_asset_rows_in_asset_items(): void {
        $errors = $this->membershipErrors(
            [['item' => ['id' => 'variant-a'], 'asset' => null]],
            [['asset' => ['id' => 'asset-a']]],
        );

        $this->assertSame([], $errors);
    }

    #[Test]
    public function rejects_a_fixed_asset_row_in_items(): void {
        $errors = $this->membershipErrors(
            [
                ['item' => ['id' => 'variant-a'], 'asset' => null],
                ['asset' => ['id' => 'asset-a']],
            ],
            [],
        );

        $this->assertSame(['items.1.asset'], array_keys($errors));
        $this->assertSame(__('asset/asset.item_must_be_regular'), $errors['items.1.asset'][0]);
    }

    #[Test]
    public function rejects_a_regular_row_in_asset_items(): void {
        $errors = $this->membershipErrors(
            [],
            [
                ['asset' => ['id' => 'asset-a']],
                ['item' => ['id' => 'variant-a'], 'asset' => null],
            ],
        );

        $this->assertSame(['asset_items.1.asset'], array_keys($errors));
        $this->assertSame(__('asset/asset.item_must_be_fixed_asset'), $errors['asset_items.1.asset'][0]);
    }

    #[Test]
    public function missing_asset_identity_in_asset_items_is_reported_for_the_required_field_rule(): void {
        $errors = $this->membershipErrors([], [['asset' => []]]);

        $this->assertSame(['asset_items.0.asset'], array_keys($errors));
    }

    #[Test]
    public function membership_uses_the_given_error_field_name(): void {
        $validator = ValidatorFacade::make([], []);

        AssetItemsRules::validateMembership(
            $validator,
            ['items' => [['v' => 'asset-a']], 'asset_items' => []],
            fn (array $rows) => array_map(fn ($row) => $row['v'], $rows),
            'sales_order_item',
        );

        $this->assertArrayHasKey('items.0.sales_order_item', $validator->errors()->toArray());
    }
}
