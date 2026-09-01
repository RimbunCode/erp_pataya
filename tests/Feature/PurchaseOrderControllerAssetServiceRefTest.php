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
use App\Models\Purchase\PurchaseOrder;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PurchaseOrderControllerAssetServiceRefTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        PurchaseOrder::initPermissions();

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
                PurchaseOrder::class => [
                    0 => [
                        [
                            'model'        => PurchaseOrder::class,
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
     * Requirement 4.5, spec asset-service-billing: AssetServiceConsumedItem.item_id
     * menunjuk ItemVariant (bukan Item langsung) — factory helper ini kembalikan
     * ItemVariant, bukan Item, supaya FK valid dan konsisten dengan
     * PurchaseOrderItem/PurchaseRequestItem.item_variant_id.
     */
    private function makeItemWithUnit(bool $isStockItem = true): array {
        $item        = Item::factory()->create(['is_stock_item' => $isStockItem]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $isStockItem]);
        $unit        = Unit::create([
            'code'              => 'PO-' . fake()->unique()->numerify('#####'),
            'name'              => 'PO Unit',
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

    public function test_create_with_asset_service_ref_prefills_items_from_consumed_items(): void {
        $user              = User::factory()->create();
        $assetService      = AssetService::factory()->create();
        [$item, $itemUnit] = $this->makeItemWithUnit();
        $consumedItem      = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $item->id,
            'item_unit_id'     => $itemUnit->id,
            'quantity'         => 5,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('purchaseOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->where('defaultData.items.0.item.id', $item->id)
                ->where('defaultData.items.0.quantity', 5)
                ->where('defaultData.items.0.unit.id', $itemUnit->id)
                ->where('defaultData.items.0.referenceable_type', AssetServiceConsumedItem::class)
                ->where('defaultData.items.0.referenceable_id', $consumedItem->id),
        );
    }

    public function test_create_with_asset_service_ref_filters_out_non_stock_items(): void {
        // Requirement 3.3, Correctness Property 2: BEDA dari case 'workOrder'
        // existing di controller ini (yang tidak filter) — keputusan
        // disengaja agar konsisten dengan case PR.
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
            ->get(route('purchaseOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertInertia(
            fn ($page) => $page
                ->has('defaultData.items', 1)
                ->where('defaultData.items.0.item.id', $stockItem->id),
        );
    }

    public function test_create_with_invalid_asset_service_ref_returns_empty_form(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('purchaseOrders.create', ['ref' => 'assetService/nonexistent']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData', null));
    }
}
