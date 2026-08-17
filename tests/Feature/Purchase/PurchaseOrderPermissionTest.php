<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseOrderService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class PurchaseOrderPermissionTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // initPermissions() menambah kolom runtime (status, code, dst) yang di
        // produksi dibuat oleh PermissionSeeder, bukan migration.
        foreach ([User::class, FormatingSeries::class, Supplier::class, PurchaseOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user = User::factory()->create();

        $this->sessionData = [
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
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                                'print'  => true,
                                'import' => true,
                                'export' => true,
                                'share'  => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function mockService(): Mockery\MockInterface {
        $mock = Mockery::mock(PurchaseOrderService::class);
        $this->app->instance(PurchaseOrderService::class, $mock);

        return $mock;
    }

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_mark_done_is_not_blocked_by_permission_gate(): void {
        $purchaseOrder = PurchaseOrderFactory::new()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('markDone')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $purchaseOrder->id)
            ->andReturn([]);

        $response = $this->authenticatedRequest()
            ->post(route('purchaseOrders.markDone', $purchaseOrder));

        $response->assertStatus(302);
    }

    public function test_sync_items_is_not_blocked_by_permission_gate(): void {
        $purchaseOrder = PurchaseOrderFactory::new()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('syncItems')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $purchaseOrder->id)
            ->andReturn([]);

        $response = $this->authenticatedRequest()
            ->post(route('purchaseOrders.syncItems', $purchaseOrder));

        $response->assertStatus(302);
    }

    public function test_submit_after_amend_preserves_revision_code(): void {
        $country       = CountryFactory::new()->create();
        $supplier      = SupplierFactory::new()->create(['country_id' => $country->code]);
        $purchaseOrder = PurchaseOrderFactory::new()->create(['supplier_id' => $supplier->id]);

        $this->authenticatedRequest()
            ->put(route('purchaseOrders.amend', $purchaseOrder));

        $amended          = PurchaseOrder::where('amended_from_id', $purchaseOrder->id)->firstOrFail();
        $codeBeforeSubmit = $amended->code;
        $this->assertStringEndsWith('-1', $codeBeforeSubmit);

        $response = $this->authenticatedRequest()
            ->put(route('purchaseOrders.submit', $amended));

        $amended->refresh();

        $response->assertStatus(302);
        $this->assertSame($codeBeforeSubmit, $amended->code);
        $this->assertNotContains(FormStatus::DRAFT, $amended->status);
    }

    public function test_mark_done_still_blocked_when_permission_missing(): void {
        $purchaseOrder = PurchaseOrderFactory::new()->create();

        $sessionWithoutWrite                                                                    = $this->sessionData;
        $sessionWithoutWrite['permissions'][PurchaseOrder::class][0][0]['permissions']['write'] = false;

        $response = $this
            ->withSession($sessionWithoutWrite)
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('purchaseOrders.markDone', $purchaseOrder));

        $response->assertForbidden();
    }

    public function test_amend_remaps_split_item_parent_reference(): void {
        $this->actingAs($this->user);

        $country       = CountryFactory::new()->create();
        $supplier      = SupplierFactory::new()->create(['country_id' => $country->code]);
        $purchaseOrder = PurchaseOrderFactory::new()->create(['supplier_id' => $supplier->id]);
        $itemVariant   = ItemVariantFactory::new()->create();

        $parentItem = $purchaseOrder->items()->create([
            'item_id'  => $itemVariant->id,
            'quantity' => 10,
            'rate'     => 1000,
        ]);
        $childItem = $purchaseOrder->items()->create([
            'item_id'        => $itemVariant->id,
            'quantity'       => 5,
            'rate'           => 1000,
            'parent_item_id' => $parentItem->id,
        ]);
        $plainItem = $purchaseOrder->items()->create([
            'item_id'  => $itemVariant->id,
            'quantity' => 3,
            'rate'     => 1000,
        ]);

        $amended = $purchaseOrder->amend();

        $newParentItem = $amended->items()->where('quantity', 10)->firstOrFail();
        $newChildItem  = $amended->items()->where('quantity', 5)->firstOrFail();
        $newPlainItem  = $amended->items()->where('quantity', 3)->firstOrFail();

        $this->assertSame($newParentItem->id, $newChildItem->parent_item_id);
        $this->assertNotSame($parentItem->id, $newChildItem->parent_item_id);
        $this->assertNull($newPlainItem->parent_item_id);
    }
}
