<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetServiceActivityGatingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach ([FormatingSeries::class, Asset::class, AssetService::class] as $model) {
            $model::initPermissions();
        }

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
                AssetService::class => [
                    0 => [
                        [
                            'model'        => AssetService::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_creating_activity_on_draft_service_is_rejected(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'test',
                'status'      => FormStatus::IN_PROGRESS->value,
            ])
            ->assertStatus(500);
    }

    public function test_creating_activity_on_approved_service_is_accepted(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();
        // NEED_CONFIRMATION, bukan APPROVED lagi -- spec asset-service-progress-workflow
        // Req 1 AC2, APPROVED tidak lagi persisten pasca-onApproved().
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::NEED_CONFIRMATION],
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'test',
                'status'      => FormStatus::IN_PROGRESS->value,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_service_activities', [
            'asset_service_id' => $service->id,
            'description'      => 'test',
        ]);
    }

    /**
     * Requirement 9 AC8: action_date tidak boleh sebelum activity pertama.
     */
    public function test_action_date_before_first_activity_is_rejected(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::IN_PROGRESS],
        ]);
        $service->activities()->create([
            'action_date' => now(),
            'description' => 'pertama',
            'status'      => FormStatus::IN_PROGRESS,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->subDay()->toDateTimeString(),
                'description' => 'backdate ekstrem',
                'status'      => FormStatus::WAITING->value,
            ])
            ->assertSessionHasErrors('action_date');

        $this->assertDatabaseMissing('asset_service_activities', ['description' => 'backdate ekstrem']);
    }

    /**
     * Requirement 9 AC10: activity status=completed wajib action_date
     * SETELAH activity terbesar yang sudah ada.
     */
    public function test_completed_action_date_not_latest_is_rejected(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::IN_PROGRESS],
        ]);
        $service->activities()->create([
            'action_date' => now(),
            'description' => 'terkini',
            'status'      => FormStatus::IN_PROGRESS,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->subHour()->toDateTimeString(), // SEBELUM activity terkini
                'description' => 'selesai lebih awal',
                'status'      => FormStatus::COMPLETED->value,
            ])
            ->assertSessionHasErrors('action_date');

        $this->assertDatabaseMissing('asset_service_activities', ['description' => 'selesai lebih awal']);
    }

    /**
     * Requirement 9 AC9: activity tidak bisa ditambah lagi setelah COMPLETED.
     */
    public function test_creating_activity_after_completed_is_rejected(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::COMPLETED],
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->addHour()->toDateTimeString(),
                'description' => 'harusnya ditolak',
                'status'      => FormStatus::IN_PROGRESS->value,
            ])
            ->assertStatus(500);

        $this->assertDatabaseMissing('asset_service_activities', ['description' => 'harusnya ditolak']);
    }

    /**
     * Requirement 2 AC4: stockAvailability() filter is_stock_item, pakai
     * ready_quantity (BUKAN quantity/actual_quantity), difilter branch_id.
     */
    public function test_stock_availability_filters_stock_item_and_branch(): void {
        $user   = User::factory()->create();
        $branch = Branch::create(['name' => 'Test Branch', 'is_main_branch' => true]);
        $asset  = Asset::factory()->create();

        $stockItem       = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $stockVariant    = ItemVariant::factory()->create(['item_id' => $stockItem->id, 'is_stock_item' => true]);
        $nonStockItem    = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => false]);
        $nonStockVariant = ItemVariant::factory()->create(['item_id' => $nonStockItem->id, 'is_stock_item' => false]);

        $unit      = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit  = ItemUnit::create(['item_id' => $stockItem->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Test Warehouse',
            'code'      => 'WH-' . fake()->unique()->numerify('####'),
        ]);

        Stock::create([
            'item_variant_id'   => $stockVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => 7,
            'conversion_factor' => 1,
            'stock_queue'       => [['quantity' => 7, 'rate' => 1000]],
        ]);

        $service = AssetService::factory()->create([
            'type'      => AssetServiceType::REPAIR,
            'asset_id'  => $asset->id,
            'branch_id' => $branch->id,
            'status'    => [FormStatus::NEED_CONFIRMATION],
        ]);
        AssetServiceConsumedItem::factory()->create(['asset_service_id' => $service->id, 'item_id' => $stockVariant->id]);
        AssetServiceConsumedItem::factory()->create(['asset_service_id' => $service->id, 'item_id' => $nonStockVariant->id]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('assetServices.stockAvailability', $service));

        $response->assertOk();
        $data = $response->json();
        $this->assertCount(1, $data, 'item non-stock TIDAK boleh muncul');
        $this->assertSame($stockVariant->id, $data[0]['item_variant_id']);
        $this->assertEqualsWithDelta(7.0, (float) $data[0]['ready_quantity'], 0.001);
    }
}
