<?php

namespace Tests\Feature\Http;

use App\Models\Asset\Asset;
use App\Models\CRM\Opportunity;
use App\Models\Finances\Account;
use App\Models\Inventory\Category;
use App\Models\Inventory\ItemVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Konfigurasi grup bawaan model untuk LinkModel/Advance Search
 * (spec linkmodel-grouping-search): level default harus ada, groupable, dan
 * lolos gerbang kolom aman endpoint lookup (linkable atau relasi).
 */
class LinkModelDefaultGroupsConfigTest extends TestCase {
    use RefreshDatabase;

    public function test_category_defaults_to_type(): void {
        $this->assertSame([['column' => 'type', 'granularity' => null, 'range' => null]], Category::getDefaultGroups());
    }

    public function test_item_variant_defaults_to_type_then_category(): void {
        $this->assertSame(['type', 'category'], array_column(ItemVariant::getDefaultGroups(), 'column'));
    }

    public function test_default_and_prop_group_columns_are_groupable_and_lookup_safe(): void {
        $cases = [
            Category::class    => ['type'],
            ItemVariant::class => ['type', 'category'],
            Account::class     => ['root_type', 'account_type'],
            Asset::class       => ['ownership'],
            Opportunity::class => ['stage'],
        ];

        foreach ($cases as $model => $columns) {
            $byName = array_column($model::getColumns(1), null, 'name');
            foreach ($columns as $column) {
                $meta = $byName[$column] ?? null;
                $this->assertNotNull($meta, "$model::$column tidak ada");
                $this->assertTrue((bool) ($meta['groupable'] ?? false), "$model::$column bukan groupable");
                $this->assertTrue(
                    ($meta['type'] ?? null) === 'relation' || ($meta['linkable'] ?? false) === true,
                    "$model::$column tak lolos gerbang kolom aman LinkModel",
                );
            }
        }
    }
}
