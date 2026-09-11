<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * spec item-request-auto-detect — Requirement 2 (index/filter), 3 (stage +
 * prefill create), 5 (module placement/permission gate).
 */
class ItemRequestControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        foreach ([SalesOrder::class, PurchaseRequest::class, PurchaseOrder::class] as $model) {
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

    private function fullPermissions(string $modelClass): array {
        return [
            $modelClass => [
                0 => [[
                    'model'        => $modelClass,
                    'level'        => 0,
                    'only_creator' => false,
                    'permissions'  => [
                        'select' => true,
                        'read'   => true,
                        'write'  => true,
                        'create' => true,
                        'delete' => true,
                    ],
                ]],
            ],
        ];
    }

    private function sessionData(): array {
        return [
            'permissions' => [
                ...$this->fullPermissions(PurchaseRequest::class),
                ...$this->fullPermissions(PurchaseOrder::class),
            ],
            'currentBranch' => null,
        ];
    }

    /** Session dengan izin penuh HANYA pada satu model (model lain tidak terdaftar sama sekali). */
    private function sessionWithOnly(string $modelClass): array {
        return [
            'permissions'   => $this->fullPermissions($modelClass),
            'currentBranch' => null,
        ];
    }

    private function ensureItemUnit(ItemVariant $variant): ItemUnit {
        $item = Item::find($variant->item_id);
        $unit = Unit::create([
            'code'              => 'PCS-' . uniqid(),
            'name'              => 'Pieces',
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);

        return ItemUnit::create([
            'item_id'           => $item->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1,
            'is_default'        => true,
        ]);
    }

    /** @return array{0: SalesOrderItem, 1: ItemUnit} */
    private function makeShortageSalesOrderItem(float $quantity = 10, float $stockQuantity = 0): array {
        $branch    = Branch::create(['name' => 'HTTP Test Branch ' . uniqid(), 'code' => strtoupper(uniqid())]);
        $warehouse = Warehouse::create(['branch_id' => $branch->id, 'name' => 'HTTP Test Warehouse', 'code' => 'WH-' . uniqid()]);
        $variant   = ItemVariant::factory()->create();
        $itemUnit  = $this->ensureItemUnit($variant);

        Stock::create([
            'item_variant_id'   => $variant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => $stockQuantity,
            'conversion_factor' => 1,
            'stock_queue'       => $stockQuantity > 0 ? [['rate' => 0, 'quantity' => $stockQuantity, 'is_valuated' => true]] : [],
        ]);

        $salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => Customer::query()->create(['name' => 'HTTP Test Customer ' . uniqid(), 'is_disabled' => false])->id,
            'created_by_id' => User::factory()->create()->id,
            'status'        => [FormStatus::DRAFT],
        ]);

        $item = SalesOrderItem::create([
            'sales_order_id'      => $salesOrder->id,
            'item_id'             => $variant->id,
            'item_unit_id'        => $itemUnit->id,
            'source_warehouse_id' => $warehouse->id,
            'quantity'            => $quantity,
            'price'               => 0,
        ]);

        return [$item, $itemUnit];
    }

    public function test_index_returns_shortage_rows(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionData())
            ->get(route('itemRequests.index'));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Purchase/ItemRequests/Index')
                ->where('rows.data.0.source_id', $item->id)
                ->where('rows.data.0.shortage_quantity', 10),
        );
    }

    public function test_stage_batch_then_create_purchase_request_prefills_items(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $stageResponse = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionData())
            ->post(route('itemRequests.stageBatch'), [
                'document_type' => 'purchaseRequest',
                'selections'    => [
                    ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 6],
                ],
            ]);

        $stageResponse->assertRedirect();
        $location = $stageResponse->headers->get('Location');
        $this->assertStringContainsString('itemRequestBatch', $location);

        $createResponse = $this->get($location);
        $createResponse->assertOk();
        $createResponse->assertInertia(
            fn ($page) => $page
                ->where('defaultData.items.0.quantity', 6)
                ->where('defaultData.items.0.referenceable_type', SalesOrderItem::class)
                ->where('defaultData.items.0.referenceable_id', $item->id)
                ->where('defaultData.items.0.item.id', $item->item_id),
        );
    }

    public function test_stage_batch_then_create_purchase_order_prefills_items(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $stageResponse = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionData())
            ->post(route('itemRequests.stageBatch'), [
                'document_type' => 'purchaseOrder',
                'selections'    => [
                    ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 4],
                ],
            ]);

        $stageResponse->assertRedirect();
        $createResponse = $this->get($stageResponse->headers->get('Location'));
        $createResponse->assertOk();
        $createResponse->assertInertia(
            fn ($page) => $page
                ->where('defaultData.items.0.quantity', 4)
                ->where('defaultData.items.0.referenceable_type', SalesOrderItem::class),
        );
    }

    public function test_index_is_blocked_when_neither_purchase_request_nor_purchase_order_select(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $sessionWithoutSelect                                                                       = $this->sessionData();
        $sessionWithoutSelect['permissions'][PurchaseRequest::class][0][0]['permissions']['select'] = false;
        $sessionWithoutSelect['permissions'][PurchaseOrder::class][0][0]['permissions']['select']   = false;

        $response = $this->actingAs(User::factory()->create())
            ->withSession($sessionWithoutSelect)
            ->get(route('itemRequests.index'));

        $response->assertForbidden();
    }

    /**
     * Bug ditemukan lewat pertanyaan user saat demo: permission gate awal
     * cuma cek PurchaseRequest (fixed, dari $this->model constructor base
     * Controller) -- user yang HANYA punya izin PurchaseOrder tidak bisa
     * lihat/pakai fitur ini sama sekali, walau niatnya cuma mau bikin PO.
     */
    public function test_index_is_allowed_with_only_purchase_order_select_permission(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionWithOnly(PurchaseOrder::class))
            ->get(route('itemRequests.index'));

        $response->assertOk();
    }

    public function test_stage_batch_purchase_order_allowed_with_only_purchase_order_create_permission(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionWithOnly(PurchaseOrder::class))
            ->post(route('itemRequests.stageBatch'), [
                'document_type' => 'purchaseOrder',
                'selections'    => [
                    ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 4],
                ],
            ]);

        $response->assertRedirect();
    }

    /**
     * User punya izin create PurchaseOrder TAPI mencoba document_type=
     * purchaseRequest -- HARUS tetap diblokir, izin PO tidak otomatis
     * memberi izin PR (bukan OR di titik ini, beda dari index()).
     */
    public function test_stage_batch_purchase_request_blocked_with_only_purchase_order_create_permission(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionWithOnly(PurchaseOrder::class))
            ->post(route('itemRequests.stageBatch'), [
                'document_type' => 'purchaseRequest',
                'selections'    => [
                    ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 4],
                ],
            ]);

        $response->assertForbidden();
    }

    public function test_stage_batch_purchase_order_blocked_with_only_purchase_request_create_permission(): void {
        [$item] = $this->makeShortageSalesOrderItem(quantity: 10);

        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionWithOnly(PurchaseRequest::class))
            ->post(route('itemRequests.stageBatch'), [
                'document_type' => 'purchaseOrder',
                'selections'    => [
                    ['source_type' => SalesOrderItem::class, 'source_id' => $item->id, 'quantity' => 4],
                ],
            ]);

        $response->assertForbidden();
    }

    public function test_regular_create_without_ref_still_works(): void {
        // Regression: case baru di switch tidak mengubah alur create() tanpa ref.
        $response = $this->actingAs(User::factory()->create())
            ->withSession($this->sessionData())
            ->get(route('purchaseRequests.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('defaultData', null));
    }
}
