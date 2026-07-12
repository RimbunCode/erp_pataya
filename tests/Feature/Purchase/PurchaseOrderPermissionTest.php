<?php

namespace Tests\Feature\Purchase;

use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseOrderService;
use Database\Factories\Purchase\PurchaseOrderFactory;
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
}
