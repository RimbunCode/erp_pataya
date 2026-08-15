<?php

namespace Tests\Feature\Sales;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Sales\SalesOrderService;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\SalesOrderFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use Tests\TestCase;

class SalesOrderPermissionTest extends TestCase {
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
        foreach ([User::class, FormatingSeries::class, Customer::class, SalesOrder::class] as $model) {
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
        $mock = Mockery::mock(SalesOrderService::class);
        $this->app->instance(SalesOrderService::class, $mock);

        return $mock;
    }

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_mark_done_is_not_blocked_by_permission_gate(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('markDone')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $salesOrder->id)
            ->andReturn([]);

        $response = $this->authenticatedRequest()
            ->post(route('salesOrders.markDone', $salesOrder));

        $response->assertStatus(302);
    }

    public function test_sync_items_is_not_blocked_by_permission_gate(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('syncItems')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $salesOrder->id)
            ->andReturn([]);

        $response = $this->authenticatedRequest()
            ->post(route('salesOrders.syncItems', $salesOrder));

        $response->assertStatus(302);
    }

    public function test_amend_creates_new_revision_and_redirects_to_it(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $response = $this->authenticatedRequest()
            ->put(route('salesOrders.amend', $salesOrder));

        $salesOrder->refresh();
        $amended = SalesOrder::where('amended_from_id', $salesOrder->id)->first();

        $this->assertNotNull($amended);
        $response->assertRedirect(route('salesOrders.show', $amended->id));
    }

    public function test_sequential_amends_on_same_root_do_not_collide(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $this->authenticatedRequest()->put(route('salesOrders.amend', $salesOrder));
        $firstAmend = SalesOrder::where('amended_from_id', $salesOrder->id)->first();

        $this->authenticatedRequest()->put(route('salesOrders.amend', $firstAmend));

        $salesOrder->refresh();
        $allAmends = SalesOrder::where('amended_from_id', $salesOrder->id)->pluck('code')->all();

        $this->assertCount(2, $allAmends);
        $this->assertCount(2, array_unique($allAmends));
        $this->assertSame(2, $salesOrder->revision_number);
    }

    public function test_amend_remaps_split_item_parent_reference(): void {
        $this->actingAs($this->user);

        $salesOrder  = SalesOrderFactory::new()->create();
        $itemVariant = ItemVariantFactory::new()->create();

        $parentItem = $salesOrder->items()->create([
            'item_id'  => $itemVariant->id,
            'quantity' => 10,
            'price'    => 1000,
        ]);
        $childItem = $salesOrder->items()->create([
            'item_id'        => $itemVariant->id,
            'quantity'       => 5,
            'price'          => 1000,
            'parent_item_id' => $parentItem->id,
        ]);
        $plainItem = $salesOrder->items()->create([
            'item_id'  => $itemVariant->id,
            'quantity' => 3,
            'price'    => 1000,
        ]);

        $amended = $salesOrder->amend();

        $newParentItem = $amended->items()->where('quantity', 10)->firstOrFail();
        $newChildItem  = $amended->items()->where('quantity', 5)->firstOrFail();
        $newPlainItem  = $amended->items()->where('quantity', 3)->firstOrFail();

        $this->assertSame($newParentItem->id, $newChildItem->parent_item_id);
        $this->assertNotSame($parentItem->id, $newChildItem->parent_item_id);
        $this->assertNull($newPlainItem->parent_item_id);
    }

    public function test_amend_throws_clear_error_on_code_collision(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $collidingCode = $salesOrder->code . '-1';
        SalesOrderFactory::new()->create(['code' => $collidingCode]);

        try {
            $salesOrder->amend();
            $this->fail('Expected a ValidationException to be thrown on code collision.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('code', $e->errors());
        }
    }

    public function test_submit_after_amend_preserves_revision_code(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $this->authenticatedRequest()
            ->put(route('salesOrders.amend', $salesOrder));

        $amended          = SalesOrder::where('amended_from_id', $salesOrder->id)->firstOrFail();
        $codeBeforeSubmit = $amended->code;
        $this->assertStringEndsWith('-1', $codeBeforeSubmit);

        $response = $this->authenticatedRequest()
            ->put(route('salesOrders.submit', $amended));

        $amended->refresh();

        $response->assertStatus(302);
        $this->assertSame($codeBeforeSubmit, $amended->code);
        $this->assertNotContains(FormStatus::DRAFT, $amended->status);
    }

    public function test_amend_still_blocked_when_permission_missing(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $sessionWithoutAmend                                                                 = $this->sessionData;
        $sessionWithoutAmend['permissions'][SalesOrder::class][0][0]['permissions']['amend'] = false;

        $response = $this
            ->withSession($sessionWithoutAmend)
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->put(route('salesOrders.amend', $salesOrder));

        $response->assertForbidden();
    }

    public function test_mark_done_still_blocked_when_permission_missing(): void {
        $salesOrder = SalesOrderFactory::new()->create();

        $sessionWithoutWrite                                                                 = $this->sessionData;
        $sessionWithoutWrite['permissions'][SalesOrder::class][0][0]['permissions']['write'] = false;

        $response = $this
            ->withSession($sessionWithoutWrite)
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('salesOrders.markDone', $salesOrder));

        $response->assertForbidden();
    }
}
