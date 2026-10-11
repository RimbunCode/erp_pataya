<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Halaman show/create mempartisi baris berdasarkan asset_id dan menyerialisasi
 * relasi Asset pada baris aset. Query filter endpoint /model menggunakan json_overlaps,
 * sehingga SQLite mendapat fungsi shim lokal dalam test ini.
 */
class AssetItemsShowPartitionTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private ItemVariant $regularVariant;
    private Asset $asset;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class, SalesOrder::class, SalesInvoice::class] as $model) {
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
        $this->user->branches()->attach($this->branch->id);

        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function ($a, $b) {
            $decodedA = json_decode((string) $a, true) ?? [];
            $decodedB = json_decode((string) $b, true) ?? [];

            return array_intersect($decodedA, $decodedB) !== [] ? 1 : 0;
        }, 2);

        $regularItem = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $assetItem   = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);

        $this->regularVariant = ItemVariant::factory()->create(['item_id' => $regularItem->id, 'is_stock_item' => true]);
        $this->asset          = Asset::factory()->rentable()->create([
            'asset_category_id' => AssetCategory::factory()->create()->id,
            'item_id'           => $assetItem->id,
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    private function sessionData(): array {
        $grant = fn (string $model) => [
            0 => [[
                'model'        => $model,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => ['select' => true, 'read' => true, 'write' => true, 'create' => true],
            ]],
        ];

        return [
            'permissions' => [
                SalesOrder::class   => $grant(SalesOrder::class),
                SalesInvoice::class => $grant(SalesInvoice::class),
                DeliveryNote::class => $grant(DeliveryNote::class),
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $this->branch->id,
        ];
    }

    private function visit(string $url) {
        return $this->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionData())
            ->get($url);
    }

    private function makeSalesOrder(): SalesOrder {
        return SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'Z', 'is_disabled' => false])->id,
            'created_by_id' => $this->user->id,
        ]);
    }

    /** @return array{0: SalesOrderItem, 1: SalesOrderItem} [regular, asset] */
    private function makeSalesOrderItems(SalesOrder $salesOrder): array {
        $regular = SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => $this->regularVariant->id,
            'quantity'       => 3,
            'price'          => 1000,
        ]);
        $asset = SalesOrderItem::create([
            'sales_order_id' => $salesOrder->id,
            'item_id'        => null,
            'asset_id'       => $this->asset->id,
            'quantity'       => 1,
            'price'          => 1000,
        ]);

        return [$regular, $asset];
    }

    #[Test]
    public function sales_order_show_returns_regular_rows_in_items_and_asset_rows_in_asset_items(): void {
        $salesOrder = $this->makeSalesOrder();
        $this->makeSalesOrderItems($salesOrder);

        $this->visit(route('salesOrders.show', $salesOrder))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('salesOrder.items', 1)
                ->where('salesOrder.items.0.item_id', $this->regularVariant->id)
                ->has('salesOrder.asset_items', 1)
                ->where('salesOrder.asset_items.0.item_id', null)
                ->where('salesOrder.asset_items.0.asset_id', $this->asset->id));
    }

    #[Test]
    public function rental_durations_of_a_rent_sales_order_still_cover_the_asset_rows(): void {
        $salesOrder = $this->makeSalesOrder();
        $salesOrder->update(['is_rent' => true, 'start_date' => now(), 'end_date' => now()->addMonth()]);
        [$regularSo, $assetSo] = $this->makeSalesOrderItems($salesOrder);

        // Baris aset SO rent ada di `asset_items`, tetapi accessor rental_durations
        // (dihitung saat serialisasi) harus tetap memuat durasinya.
        $this->visit(route('salesOrders.show', $salesOrder))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('salesOrder.asset_items', 1)
                ->has("salesOrder.rental_durations.{$assetSo->id}")
                ->has("salesOrder.rental_durations.{$regularSo->id}"));
    }

    #[Test]
    public function sales_invoice_show_returns_two_lists_and_loads_the_direct_asset_relation(): void {
        $salesOrder            = $this->makeSalesOrder();
        [$regularSo, $assetSo] = $this->makeSalesOrderItems($salesOrder);
        $salesInvoice          = SalesInvoice::factory()->create([
            'created_by_id'  => $this->user->id,
            'sales_order_id' => $salesOrder->id,
        ]);
        SalesInvoiceItem::factory()->create([
            'sales_invoice_id'    => $salesInvoice->id,
            'sales_order_item_id' => $regularSo->id,
            'item_id'             => $this->regularVariant->id,
        ]);
        SalesInvoiceItem::factory()->create([
            'sales_invoice_id'    => $salesInvoice->id,
            'sales_order_item_id' => $assetSo->id,
            'item_id'             => null,
            'asset_id'            => $this->asset->id,
        ]);

        $this->visit(route('salesInvoices.show', $salesInvoice))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('salesInvoice.items', 1)
                ->where('salesInvoice.items.0.item_id', $this->regularVariant->id)
                ->has('salesInvoice.asset_items', 1)
                ->where('salesInvoice.asset_items.0.item_id', null)
                ->where('salesInvoice.asset_items.0.asset_id', $this->asset->id)
                ->where('salesInvoice.asset_items.0.asset.id', $this->asset->id)
                ->where('salesInvoice.asset_items.0.sales_order_item.asset.id', $this->asset->id));
    }

    #[Test]
    public function delivery_note_show_returns_two_lists_and_loads_the_direct_asset_relation(): void {
        $deliveryNote          = DeliveryNote::factory()->create(['created_by_id' => $this->user->id]);
        [$regularSo, $assetSo] = $this->makeSalesOrderItems(SalesOrder::find($deliveryNote->referenceable_id));

        DeliveryNoteItem::factory()->create([
            'delivery_note_id'   => $deliveryNote->id, 'item_id' => $this->regularVariant->id,
            'referenceable_id'   => $regularSo->id,
            'referenceable_type' => SalesOrderItem::class,
        ]);
        DeliveryNoteItem::factory()->create([
            'delivery_note_id'   => $deliveryNote->id,
            'item_id'            => null,
            'asset_id'           => $this->asset->id,
            'referenceable_id'   => $assetSo->id,
            'referenceable_type' => SalesOrderItem::class,
        ]);

        $this->visit(route('deliveryNotes.show', $deliveryNote))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('deliveryNote.items', 1)
                ->where('deliveryNote.items.0.item_id', $this->regularVariant->id)
                ->has('deliveryNote.asset_items', 1)
                ->where('deliveryNote.asset_items.0.item_id', null)
                ->where('deliveryNote.asset_items.0.asset_id', $this->asset->id)
                ->where('deliveryNote.asset_items.0.referenceable_id', $assetSo->id)
                ->where('deliveryNote.asset_items.0.referenceable_type', SalesOrderItem::class)
                ->where('deliveryNote.asset_items.0.referenceable.asset.id', $this->asset->id));
    }

    #[Test]
    public function delivery_note_created_from_a_sales_order_now_prefills_asset_rows_into_asset_items(): void {
        $salesOrder            = $this->makeSalesOrder();
        [$regularSo, $assetSo] = $this->makeSalesOrderItems($salesOrder);
        // baris jasa (bukan stok, bukan aset) tetap tidak ikut prefill DN
        $serviceItem    = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => false]);
        $serviceVariant = ItemVariant::factory()->create(['item_id' => $serviceItem->id, 'is_stock_item' => false]);
        SalesOrderItem::create(['sales_order_id' => $salesOrder->id, 'item_id' => $serviceVariant->id, 'quantity' => 1, 'price' => 0]);

        $this->visit(route('deliveryNotes.create', ['ref' => "salesOrder/{$salesOrder->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('defaultData.items', 1)
                ->where('defaultData.items.0.referenceable_id', $regularSo->id)
                ->has('defaultData.asset_items', 1)
                ->where('defaultData.asset_items.0.referenceable_id', $assetSo->id)
                ->where('defaultData.asset_items.0.asset.id', $this->asset->id));
    }

    #[Test]
    public function delivery_note_return_prefills_the_direct_asset_relation_into_asset_items(): void {
        $sourceNote  = DeliveryNote::factory()->create(['created_by_id' => $this->user->id]);
        $salesOrder  = SalesOrder::findOrFail($sourceNote->referenceable_id);
        [, $assetSo] = $this->makeSalesOrderItems($salesOrder);
        DeliveryNoteItem::create([
            'delivery_note_id'   => $sourceNote->id,
            'item_id'            => null,
            'asset_id'           => $this->asset->id,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $assetSo->id,
            'quantity'           => 1,
            'valuation_rates'    => [],
        ]);

        $this->visit(route('deliveryNotes.create', ['ref' => "deliveryNote/{$sourceNote->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('defaultData.items', 0)
                ->has('defaultData.asset_items', 1)
                ->where('defaultData.asset_items.0.asset.id', $this->asset->id)
                ->where('defaultData.asset_items.0.referenceable_id', $assetSo->id));
    }

    #[Test]
    public function sales_invoice_created_from_a_sales_order_partitions_the_prefilled_rows(): void {
        $salesOrder            = $this->makeSalesOrder();
        [$regularSo, $assetSo] = $this->makeSalesOrderItems($salesOrder);

        $this->visit(route('salesInvoices.create', ['ref' => "salesOrder/{$salesOrder->id}"]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('defaultData.items', 1)
                ->where('defaultData.items.0.sales_order_item.id', $regularSo->id)
                ->has('defaultData.asset_items', 1)
                ->where('defaultData.asset_items.0.sales_order_item.id', $assetSo->id));
    }
}
