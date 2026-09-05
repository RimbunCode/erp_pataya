<?php

namespace Tests\Feature\Inventory;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\DeliveryNoteItemAsset;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\Permission;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Requirement 1.1/1.7, spec asset-rental-migration: sebelum fix ini,
 * DeliveryNoteRequest::rules() tidak mendeklarasikan items.*.asset_lines,
 * sehingga $request->validated() membuang seluruh Asset yang dipilih user di
 * FE sebelum sampai ke DeliveryNoteService — Asset rental/jual-putus tidak
 * pernah tersimpan sebagai DeliveryNoteItemAsset lewat alur create() nyata
 * (test lain bypass ini via factory langsung, pola sama seperti
 * InternalOrderSourceWarehouseTest utk bug source_warehouse serupa).
 */
class DeliveryNoteAssetLinesPersistenceTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        // HasBranch (dipakai Asset via Submitable) memfilter berdasar branch_id
        // kecuali user terafiliasi branch utama — tanpa ini Asset::find() dalam
        // request cycle gagal walau record ada (branch_id-nya null).
        $this->user->branches()->attach($this->branch->id);

        // DeliveryNoteController::create() (case 'deliveryNote') pakai
        // whereRaw('json_overlaps(...)') — MySQL-only, tidak ada di SQLite
        // test env (bug infrastruktur pre-existing, lihat SalesInvoiceRentalPrefillTest).
        // Shim lokal ini cuma dipakai test class ini, agar HTTP request retur
        // bisa jalan penuh tanpa replikasi logic controller secara manual.
        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function ($a, $b) {
            $decodedA = json_decode((string) $a, true) ?? [];
            $decodedB = json_decode((string) $b, true) ?? [];

            return array_intersect($decodedA, $decodedB) !== [] ? 1 : 0;
        }, 2);
    }

    private function sessionWithPermissions(): array {
        return [
            'permissions' => [
                DeliveryNote::class => [
                    0 => [[
                        'model'        => DeliveryNote::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => ['select' => true, 'read' => true, 'write' => true, 'create' => true],
                    ]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $this->branch->id,
        ];
    }

    private function makeAsset(?string $itemId = null): Asset {
        $itemId ??= Item::factory()->create(['is_fixed_asset' => true])->id;
        $category = AssetCategory::factory()->rentable()->create();

        return Asset::factory()->create(['asset_category_id' => $category->id, 'item_id' => $itemId]);
    }

    private function makeItemUnit(string $itemId): string {
        $unitMasterId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitMasterId,
            'code'              => 'PCS-' . $unitMasterId,
            'name'              => 'PCS',
            'conversion_factor' => 1,
            'is_default'        => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemId,
            'unit_id'           => $unitMasterId,
            'conversion_factor' => 1,
            'is_default'        => true,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    private function makeSalesOrderItem(Asset $asset, string $customerId): SalesOrderItem {
        SalesOrder::initPermissions();
        $itemVariant = ItemVariant::factory()->create(['item_id' => $asset->item_id]);
        $salesOrder  = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => $customerId,
            'created_by_id' => $this->user->id,
        ]);

        return SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $itemVariant->id,
            'quantity'       => 1,
            'price'          => 0,
        ]);
    }

    private function buildPayload(SalesOrderItem $soItem, string $customerId, string $itemRowId, string $itemId, array $extraItemFields, string $referenceToId): array {
        return [
            'delivery_date'      => now()->toDateString(),
            'reference_to'       => ['id' => $referenceToId, 'model' => SalesOrder::class],
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $soItem->sales_order_id,
            'customer'           => ['id' => $customerId],
            'customer_branch'    => ['id' => $this->branch->id],
            'items'              => [
                [
                    'id'                 => $itemRowId,
                    'unit'               => ['id' => $this->makeItemUnit($itemId)],
                    'quantity'           => 1,
                    'referenceable_type' => SalesOrderItem::class,
                    'referenceable_id'   => $soItem->id,
                    ...$extraItemFields,
                ],
            ],
        ];
    }

    private function makeReferenceTo(): string {
        return Permission::create([
            'module' => 'inventory',
            'name'   => 'dn_' . fake()->unique()->numerify('####'),
            'model'  => SalesOrder::class,
        ])->id;
    }

    #[Test]
    public function asset_lines_are_persisted_when_delivery_note_is_created(): void {
        $asset      = $this->makeAsset();
        $customerId = Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id;
        $soItem     = $this->makeSalesOrderItem($asset, $customerId);
        $warehouse  = WarehouseFactory::new()->create();

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions())
            ->post('/deliveryNotes', $this->buildPayload($soItem, $customerId, (string) Str::ulid(), $asset->item_id, [
                'source_warehouse' => ['id' => $warehouse->id],
                'asset_lines'      => [
                    ['asset' => ['id' => $asset->id], 'quantity' => 1],
                ],
            ], $this->makeReferenceTo()));

        $response->assertSessionHasNoErrors();

        $deliveryNote = DeliveryNote::first();
        $this->assertNotNull($deliveryNote, 'DeliveryNote harus tersimpan');

        $item = $deliveryNote->items()->first();
        $this->assertNotNull($item, 'DeliveryNoteItem harus tersimpan');

        $lines = DeliveryNoteItemAsset::where('delivery_note_item_id', $item->id)->get();
        $this->assertCount(1, $lines, 'DeliveryNoteItemAsset harus tersimpan dari asset_lines payload');
        $this->assertSame($asset->id, $lines->first()->asset_id);
    }

    #[Test]
    public function asset_lines_are_replaced_when_delivery_note_is_updated(): void {
        $assetA     = $this->makeAsset();
        $assetB     = $this->makeAsset($assetA->item_id);
        $customerId = Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id;
        $soItem     = $this->makeSalesOrderItem($assetA, $customerId);
        $warehouse  = WarehouseFactory::new()->create();
        $itemRowId  = (string) Str::ulid();

        $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions())
            ->post('/deliveryNotes', $this->buildPayload($soItem, $customerId, $itemRowId, $assetA->item_id, [
                'source_warehouse' => ['id' => $warehouse->id],
                'asset_lines'      => [
                    ['asset' => ['id' => $assetA->id], 'quantity' => 1],
                ],
            ], $this->makeReferenceTo()));

        $deliveryNote = DeliveryNote::first();
        $existingItem = $deliveryNote->items()->first();

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions())
            ->put("/deliveryNotes/{$deliveryNote->id}", $this->buildPayload($soItem, $customerId, (string) $existingItem->id, $assetB->item_id, [
                'source_warehouse' => ['id' => $warehouse->id],
                'asset_lines'      => [
                    ['asset' => ['id' => $assetB->id], 'quantity' => 1],
                ],
            ], $this->makeReferenceTo()));

        $response->assertSessionHasNoErrors();

        $lines = DeliveryNoteItemAsset::where('delivery_note_item_id', $existingItem->id)->get();
        $this->assertCount(1, $lines, 'Hanya asset_lines terbaru yang aktif');
        $this->assertSame($assetB->id, $lines->first()->asset_id);
    }

    #[Test]
    public function asset_lines_are_prefilled_when_creating_a_return_delivery_note(): void {
        $asset      = $this->makeAsset();
        $customerId = Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id;
        $soItem     = $this->makeSalesOrderItem($asset, $customerId);

        DeliveryNote::initPermissions();
        $sourceDn = DeliveryNote::create([
            'code'               => fake()->unique()->bothify('DN-####'),
            'delivery_date'      => now(),
            'reference_to_id'    => $this->makeReferenceTo(),
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $soItem->sales_order_id,
            'created_by_id'      => $this->user->id,
        ]);
        $sourceItem = DeliveryNoteItem::create([
            'delivery_note_id'   => $sourceDn->id,
            'item_id'            => $soItem->item_id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'quantity'           => 1,
            'valuation_rates'    => [],
        ]);
        DeliveryNoteItemAsset::factory()->create([
            'delivery_note_item_id' => $sourceItem->id,
            'asset_id'              => $asset->id,
            'quantity'              => 1,
        ]);

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithPermissions())
            ->get(route('deliveryNotes.create', ['ref' => "deliveryNote/{$sourceDn->id}"]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->where('defaultData.items.0.asset_lines.0.asset.id', $asset->id)
                ->where('defaultData.items.0.asset_lines.0.quantity', 1),
        );
    }
}
