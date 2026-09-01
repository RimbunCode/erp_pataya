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
use App\Models\Sales\InternalOrder;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Requirement 2.3, spec asset-service-billing-reference-flow.
 * InternalOrderController::create() sebelumnya SAMA SEKALI tidak menerima
 * parameter $ref (beda dari SalesOrderController) -- test ini juga jadi
 * regression guard supaya signature tidak diam-diam berubah lagi.
 */
class InternalOrderControllerAssetServiceRefTest extends TestCase {
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
                InternalOrder::class => [
                    0 => [
                        [
                            'model'        => InternalOrder::class,
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

    private function makeItemWithUnit(bool $isStockItem = true): array {
        $item        = Item::factory()->create(['is_stock_item' => $isStockItem]);
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id, 'is_stock_item' => $isStockItem]);
        $unit        = Unit::create([
            'code'              => 'IO-' . fake()->unique()->numerify('#####'),
            'name'              => 'IO Unit',
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
        $consumedItem      = AssetServiceConsumedItem::factory()->create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $item->id,
            'item_unit_id'     => $itemUnit->id,
            'quantity'         => 3,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('internalOrders.create', ['ref' => "assetService/{$assetService->id}"]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->where('defaultData.referenceable_type', AssetService::class)
                ->where('defaultData.referenceable_id', $assetService->id)
                ->where('defaultData.items.0.item.id', $item->id)
                ->where('defaultData.items.0.quantity', 3)
                ->where('defaultData.items.0.unit.id', $itemUnit->id)
                ->where('defaultData.items.0.assetServiceLocked', true)
                ->where('defaultData.items.0.referenceable_type', AssetServiceConsumedItem::class)
                ->where('defaultData.items.0.referenceable_id', $consumedItem->id),
        );
    }

    public function test_create_without_ref_returns_empty_form_like_before(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('internalOrders.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData', null));
    }

    public function test_create_with_invalid_asset_service_ref_returns_empty_form(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('internalOrders.create', ['ref' => 'assetService/nonexistent']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData', null));
    }
}
