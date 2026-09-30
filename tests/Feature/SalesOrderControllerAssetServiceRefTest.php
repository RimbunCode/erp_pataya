<?php

namespace Tests\Feature;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Requirement 2.1, 2.2, spec asset-service-billing-reference-flow.
 */
class SalesOrderControllerAssetServiceRefTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                SalesOrder::class => [
                    0 => [
                        [
                            'model'        => SalesOrder::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * AssetServiceConsumedItem.item_id menunjuk ItemVariant (bukan Item
     * langsung), lihat reference_linkmodel_search_endpoint_constraints.
     */
    private function makeItemWithUnit(bool $isStockItem = true): array {
        $item        = Item::factory()->create(['is_stock_item' => $isStockItem]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $isStockItem]);
        $unit        = Unit::create([
            'code'              => 'SO-' . fake()->unique()->numerify('#####'),
            'name'              => 'SO Unit',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return [$itemVariant, $itemUnit];
    }

    public function test_create_with_asset_service_ref_prefills_document_reference_and_items(): void {
        $user              = User::factory()->create();
        $assetService      = AssetService::factory()->create();
        [$item, $itemUnit] = $this->makeItemWithUnit();
        // valuation_rate DIPATOK (bukan dibiarkan acak dari factory) karena
        // assertInertia()->where() membandingkan secara STRICT. Model meng-cast
        // valuation_rate ke float, tapi json_encode(92582.0) menghasilkan
        // "92582" tanpa titik desimal — terbaca int saat di-assert, sehingga
        // 92582 !== 92582.0 dan test gagal. AssetServiceConsumedItemFactory
        // memakai fake()->randomFloat(2, 1000, 100000) yang sesekali memang
        // menghasilkan bilangan bulat, jadi test ini flaky tergantung seed.
        // Nilai berdesimal nyata membuatnya deterministik tanpa melemahkan
        // assertion-nya.
        $consumedItem = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $item->id,
            'item_unit_id'     => $itemUnit->id,
            'quantity'         => 3,
            'valuation_rate'   => 1234.56,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('salesOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->where('defaultData.referenceable_type', AssetService::class)
                ->where('defaultData.referenceable_id', $assetService->id)
                ->where('defaultData.items.0.item.id', $item->id)
                ->where('defaultData.items.0.quantity', 3)
                ->where('defaultData.items.0.unit.id', $itemUnit->id)
                ->where('defaultData.items.0.price', $consumedItem->valuation_rate)
                ->where('defaultData.items.0.assetServiceLocked', true)
                ->where('defaultData.items.0.referenceable_type', AssetServiceConsumedItem::class)
                ->where('defaultData.items.0.referenceable_id', $consumedItem->id),
        );
    }

    public function test_create_with_asset_service_ref_does_not_filter_non_stock_items(): void {
        $user                          = User::factory()->create();
        $assetService                  = AssetService::factory()->create();
        [$stockItem, $stockUnit]       = $this->makeItemWithUnit(true);
        [$nonStockItem, $nonStockUnit] = $this->makeItemWithUnit(false);
        AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $stockItem->id,
            'item_unit_id'     => $stockUnit->id,
        ]);
        AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $nonStockItem->id,
            'item_unit_id'     => $nonStockUnit->id,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('salesOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertInertia(
            fn ($page) => $page->has('defaultData.items', 2),
        );
    }

    public function test_create_with_asset_service_ref_prefills_customer_when_bill_to_renter(): void {
        // Requirement 7.1, spec asset-service-billing-reference-flow — prefill
        // customer di level dokumen sudah harus terjadi SEJAK create-from-source,
        // bukan menunggu interaksi picker Item manual.
        $user         = User::factory()->create();
        $customer     = Customer::query()->create(['name' => 'Renter', 'is_disabled' => false]);
        $assetService = AssetService::factory()->create([
            'bill_to_renter' => true,
            'customer_id'    => $customer->id,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('salesOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertInertia(
            fn ($page) => $page->where('defaultData.customer.id', $customer->id),
        );
    }

    public function test_create_with_invalid_asset_service_ref_returns_empty_form(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('salesOrders.create', ['ref' => 'assetService/nonexistent']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData', null));
    }
}
