<?php

namespace Tests\Feature;

use App\Enums\AssetServiceType;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetServiceStoreConsumedItemPayloadTest extends TestCase {
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

    public function test_store_accepts_nested_item_and_unit_payload_from_fe(): void {
        // Requirement 4.5, spec asset-service-billing: FE kirim ItemVariant
        // (bukan Item langsung) sejak AssetServiceConsumedItem.item_id
        // direwire ke ItemVariant — lihat Asset/Services/Form.jsx.
        $user        = User::factory()->create();
        $asset       = Asset::factory()->create();
        $item        = Item::factory()->create();
        $itemVariant = ItemVariant::factory()->create(['item_id' => $item->id]);
        $unit        = Unit::create([
            'code'              => 'FE-' . fake()->unique()->numerify('#####'),
            'name'              => 'FE Unit',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
        $itemUnit = ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.store'), [
                'type'          => AssetServiceType::REPAIR->value,
                'asset'         => ['id' => $asset->id],
                'failure_date'  => now()->toDateString(),
                'consumedItems' => [
                    [
                        'item'     => ['id' => $itemVariant->id],
                        'unit'     => ['id' => $itemUnit->id],
                        'quantity' => 4,
                    ],
                ],
            ]);

        $response->assertRedirect();

        $consumedItem = AssetServiceConsumedItem::first();
        $this->assertNotNull($consumedItem);
        $this->assertSame($itemVariant->id, $consumedItem->item_id);
        $this->assertSame($itemUnit->id, $consumedItem->item_unit_id);
    }

    public function test_store_rejects_consumed_item_missing_unit(): void {
        $user        = User::factory()->create();
        $asset       = Asset::factory()->create();
        $itemVariant = ItemVariant::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.store'), [
                'type'          => AssetServiceType::REPAIR->value,
                'asset'         => ['id' => $asset->id],
                'failure_date'  => now()->toDateString(),
                'consumedItems' => [
                    [
                        'item'     => ['id' => $itemVariant->id],
                        'quantity' => 4,
                    ],
                ],
            ]);

        $response->assertSessionHasErrors('consumedItems.0.unit.id');
    }
}
