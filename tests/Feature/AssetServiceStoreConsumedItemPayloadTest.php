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

    /**
     * [FIXED] Inertia useForm() selalu mengirim SELURUH key `data`, termasuk
     * asset_maintenance_task_id=null untuk record type=repair (field itu
     * milik cabang maintenance_task yang sedang tidak aktif). Rule sebelumnya
     * tidak punya 'nullable' di samping required/prohibited kondisional,
     * jadi rule 'string'/'exists' tetap dievaluasi thd null dan gagal
     * "must be a string" walau field memang seharusnya kosong.
     */
    public function test_store_accepts_null_asset_maintenance_task_id_when_type_repair(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetServices.store'), [
                'type'                      => AssetServiceType::REPAIR->value,
                'asset'                     => ['id' => $asset->id],
                'failure_date'              => now()->toDateString(),
                'asset_maintenance_task_id' => null,
            ]);

        $response->assertRedirect();
    }

    /**
     * [FIXED] AssetServiceController::show() sebelumnya cuma toArray() mentah
     * -- Eloquent otomatis snake_case relation key (consumedItems() jadi
     * "consumed_items", itemUnit() jadi "item_unit"), padahal Form.jsx baca
     * key camelCase "consumedItems" dgn sub-key "unit". Akibatnya baris yang
     * sudah tersimpan tidak pernah tampil lagi setelah reload/reopen.
     */
    public function test_show_returns_consumed_items_with_camel_case_key_and_unit_alias(): void {
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

        $assetService = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);
        AssetServiceConsumedItem::create([
            'asset_service_id' => $assetService->id,
            'item_id'          => $itemVariant->id,
            'item_unit_id'     => $itemUnit->id,
            'quantity'         => 4,
            'valuation_rate'   => 0,
        ]);

        $response = $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('assetServices.show', $assetService));

        $response->assertOk();

        // assertInertia()/assertViewHas('page') tidak reliable di sini --
        // HandleInertiaRequests dinonaktifkan di setUp() (lihat komentar
        // withoutMiddleware di atas), sehingga $response->original bukan lagi
        // instance View. Ekstrak langsung atribut data-page dari HTML mentah,
        // sama seperti yang dibaca app.js/Inertia client di browser.
        preg_match('/data-page="([^"]+)"/', $response->getContent(), $matches);
        $this->assertNotEmpty($matches, 'data-page attribute tidak ditemukan di response HTML');
        $page = json_decode(html_entity_decode($matches[1]), true);

        $consumedItem = $page['props']['assetService']['consumedItems'][0];
        $this->assertSame($itemVariant->id, $consumedItem['item']['id']);
        $this->assertSame($itemUnit->id, $consumedItem['unit']['id']);
        $this->assertEquals(4, $consumedItem['quantity']);
    }
}
