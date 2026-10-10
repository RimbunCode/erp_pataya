<?php

namespace Tests\Feature\Http;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\InternalOrderItem;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Source-row LinkModel filters Asset Items by the direct nullable asset_id. */
class LinkModelFixedAssetFilterTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private ItemVariant $regularVariant;
    private Asset $asset;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();

        SalesOrder::initPermissions();
        InternalOrder::initPermissions();
        $this->user = User::factory()->create();
        $branch     = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $this->user->branches()->attach($branch->id);

        $regularItem          = Item::factory()->create(['is_fixed_asset' => false]);
        $assetItem            = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);
        $this->regularVariant = ItemVariant::factory()->create(['item_id' => $regularItem->id]);
        $this->asset          = Asset::factory()->rentable()->create([
            'asset_category_id' => AssetCategory::factory()->create()->id,
            'item_id'           => $assetItem->id,
            'asset_name'        => 'Forklift searchable asset',
        ]);
    }

    /**
     * @param  array<string,mixed>  $filters
     * @return list<string>
     */
    private function lookupIds(string $model, array $filters, string $search = ''): array {
        $response = $this->actingAs($this->user)
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), ['model' => $model, 'filters' => $filters, 'search' => $search]);

        $response->assertOk();

        return collect($response->json('data'))->pluck('id')->sort()->values()->all();
    }

    /**
     * @return array{regular:SalesOrderItem,asset:SalesOrderItem,order:SalesOrder}
     */
    private function makeSalesOrderItems(): array {
        $order = SalesOrder::create([
            'code'        => fake()->unique()->bothify('SO-####'),
            'date'        => now(),
            'customer_id' => Customer::query()->create([
                'name'        => fake()->unique()->company(),
                'is_disabled' => false,
            ])->id,
            'created_by_id' => $this->user->id,
        ]);
        $regular = SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'item_id'        => $this->regularVariant->id,
            'quantity'       => 2,
            'price'          => 1000,
        ]);
        $asset = SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'item_id'        => null,
            'asset_id'       => $this->asset->id,
            'quantity'       => 1,
            'price'          => 1000,
        ]);

        return ['regular' => $regular, 'asset' => $asset, 'order' => $order];
    }

    #[Test]
    public function sales_order_item_lookup_filters_by_direct_asset_id_presence(): void {
        $items = $this->makeSalesOrderItems();

        $this->assertSame(
            [$items['asset']->id],
            $this->lookupIds(SalesOrderItem::class, ['asset_id' => ['!=' => null]]),
        );
        $this->assertSame(
            [$items['regular']->id],
            $this->lookupIds(SalesOrderItem::class, ['asset_id' => null]),
        );
    }

    #[Test]
    public function asset_id_filter_combines_with_the_selected_sales_order(): void {
        $first  = $this->makeSalesOrderItems();
        $second = $this->makeSalesOrderItems();

        $this->assertSame(
            [$first['asset']->id],
            $this->lookupIds(SalesOrderItem::class, [
                'sales_order_id' => $first['order']->id,
                'asset_id'       => ['!=' => null],
            ]),
        );
        $this->assertSame(
            [$second['regular']->id],
            $this->lookupIds(SalesOrderItem::class, [
                'sales_order_id' => $second['order']->id,
                'asset_id'       => null,
            ]),
        );
    }

    #[Test]
    public function conditional_template_search_resolves_asset_relation_fields(): void {
        $items = $this->makeSalesOrderItems();

        $this->assertSame(
            [$items['asset']->id],
            $this->lookupIds(SalesOrderItem::class, [], 'Forklift searchable asset'),
        );
    }

    #[Test]
    public function internal_order_item_lookup_remains_scoped_to_its_source_document(): void {
        $order = InternalOrder::create([
            'code'          => fake()->unique()->bothify('IO-####'),
            'date'          => now(),
            'created_by_id' => $this->user->id,
        ]);
        $item = InternalOrderItem::create([
            'internal_order_id' => $order->id,
            'item_id'           => $this->regularVariant->id,
            'quantity'          => 1,
        ]);

        $this->assertSame(
            [$item->id],
            $this->lookupIds(InternalOrderItem::class, ['internal_order_id' => $order->id]),
        );
    }
}
