<?php

namespace Tests\Feature\Inventory;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class WarehouseBranchScopeTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branchA;
    private Branch $branchB;
    private Branch $mainBranch;

    /** @var array<string, mixed> */
    private array $permissions;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([HandleInertiaRequests::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class, AppMiddleware::class]);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branchA    = $this->createBranch('Branch A');
        $this->branchB    = $this->createBranch('Branch B');
        $this->mainBranch = $this->createBranch('Main Branch', isMain: true);

        $this->user = User::factory()->create();

        $this->permissions = [
            Warehouse::class => [
                0 => [
                    [
                        'model'        => Warehouse::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => [
                            'select' => true,
                            'read'   => true,
                            'write'  => true,
                            'create' => true,
                            'delete' => true,
                            'import' => true,
                            'export' => true,
                            'share'  => true,
                        ],
                    ],
                ],
            ],
        ];
    }

    private function createBranch(string $name, bool $isMain = false): Branch {
        return Branch::create([
            'code'                => Str::upper(Str::random(6)),
            'name'                => $name,
            'branchable_type'     => null,
            'branchable_id'       => null,
            'is_main_branch'      => $isMain,
            'is_disabled'         => false,
            'billing_address'     => 'same_shipping',
            'shipping_street'     => 'Jl. Test',
            'shipping_city'       => 'Jakarta',
            'shipping_state'      => 'DKI Jakarta',
            'shipping_zip_code'   => '12345',
            'shipping_country_id' => null,
        ]);
    }

    private function sessionFor(?string $currentBranch): array {
        return [
            'permissions'         => $this->permissions,
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $currentBranch,
        ];
    }

    public function test_index_only_shows_warehouses_from_current_branch_when_not_main_branch(): void {
        WarehouseFactory::new()->create(['branch_id' => $this->branchA->id, 'name' => 'Warehouse A']);
        WarehouseFactory::new()->create(['branch_id' => $this->branchB->id, 'name' => 'Warehouse B']);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->actingAs($this->user)
            ->getJson(route('warehouses.index'));

        $response->assertOk();
        $names = collect($response->json('props.data.data'))->pluck('name');

        $this->assertContains('Warehouse A', $names);
        $this->assertNotContains('Warehouse B', $names);
    }

    public function test_index_shows_all_warehouses_when_current_branch_is_main_branch(): void {
        WarehouseFactory::new()->create(['branch_id' => $this->branchA->id, 'name' => 'Warehouse A']);
        WarehouseFactory::new()->create(['branch_id' => $this->branchB->id, 'name' => 'Warehouse B']);

        $response = $this
            ->withSession($this->sessionFor($this->mainBranch->id))
            ->withCookie('lang', 'en')
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->actingAs($this->user)
            ->getJson(route('warehouses.index'));

        $response->assertOk();
        $names = collect($response->json('props.data.data'))->pluck('name');

        $this->assertContains('Warehouse A', $names);
        $this->assertContains('Warehouse B', $names);
    }

    public function test_show_other_branch_warehouse_is_blocked_for_non_main_branch_user(): void {
        $warehouseB = WarehouseFactory::new()->create(['branch_id' => $this->branchB->id]);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('warehouses.show', $warehouseB));

        $response->assertNotFound();
    }

    public function test_show_other_branch_warehouse_is_allowed_for_user_affiliated_with_main_branch(): void {
        $this->user->branches()->attach($this->mainBranch->id);
        $warehouseB = WarehouseFactory::new()->create(['branch_id' => $this->branchB->id]);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('warehouses.show', $warehouseB));

        $response->assertOk();
    }
}
