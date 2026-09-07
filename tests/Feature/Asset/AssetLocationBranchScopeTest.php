<?php

namespace Tests\Feature\Asset;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetLocation;
use App\Models\Core\Branch;
use App\Models\User\User;
use Database\Factories\Asset\AssetLocationFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Parity dengan WarehouseBranchScopeTest — AssetLocation pakai trait HasBranch
 * yang sama, jadi listing/show-nya HARUS mengikuti aturan branch aktif yang sama.
 */
class AssetLocationBranchScopeTest extends TestCase {
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
            AssetLocation::class => [
                0 => [
                    [
                        'model'        => AssetLocation::class,
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

    public function test_index_only_shows_locations_from_current_branch_when_not_main_branch(): void {
        AssetLocationFactory::new()->create(['branch_id' => $this->branchA->id, 'location_name' => 'Location A']);
        AssetLocationFactory::new()->create(['branch_id' => $this->branchB->id, 'location_name' => 'Location B']);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->actingAs($this->user)
            ->getJson(route('assetLocations.index'));

        $response->assertOk();
        $names = collect($response->json('props.data.data'))->pluck('location_name');

        $this->assertContains('Location A', $names);
        $this->assertNotContains('Location B', $names);
    }

    public function test_index_shows_all_locations_when_current_branch_is_main_branch(): void {
        AssetLocationFactory::new()->create(['branch_id' => $this->branchA->id, 'location_name' => 'Location A']);
        AssetLocationFactory::new()->create(['branch_id' => $this->branchB->id, 'location_name' => 'Location B']);

        $response = $this
            ->withSession($this->sessionFor($this->mainBranch->id))
            ->withCookie('lang', 'en')
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->actingAs($this->user)
            ->getJson(route('assetLocations.index'));

        $response->assertOk();
        $names = collect($response->json('props.data.data'))->pluck('location_name');

        $this->assertContains('Location A', $names);
        $this->assertContains('Location B', $names);
    }

    public function test_show_other_branch_location_is_blocked_for_non_main_branch_user(): void {
        $locationB = AssetLocationFactory::new()->create(['branch_id' => $this->branchB->id]);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('assetLocations.show', $locationB));

        $response->assertNotFound();
    }

    public function test_show_other_branch_location_is_allowed_for_user_affiliated_with_main_branch(): void {
        $this->user->branches()->attach($this->mainBranch->id);
        $locationB = AssetLocationFactory::new()->create(['branch_id' => $this->branchB->id]);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('assetLocations.show', $locationB));

        $response->assertOk();
    }

    public function test_store_rejects_branch_outside_user_access(): void {
        $this->user->branches()->attach($this->branchA->id);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->actingAs($this->user)
            ->postJson(route('assetLocations.store'), [
                'branch_id'     => $this->branchB->id,
                'location_name' => 'Lokasi Spoof',
            ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['branch_id']);
        $this->assertDatabaseMissing('asset_locations', ['location_name' => 'Lokasi Spoof']);
    }

    public function test_store_allows_branch_within_user_access(): void {
        $this->user->branches()->attach($this->branchA->id);

        $response = $this
            ->withSession($this->sessionFor($this->branchA->id))
            ->actingAs($this->user)
            ->postJson(route('assetLocations.store'), [
                'branch_id'     => $this->branchA->id,
                'location_name' => 'Lokasi A',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('asset_locations', ['location_name' => 'Lokasi A', 'branch_id' => $this->branchA->id]);
    }

    public function test_store_allows_any_branch_for_user_affiliated_with_main_branch(): void {
        $this->user->branches()->attach($this->mainBranch->id);

        $response = $this
            ->withSession($this->sessionFor($this->mainBranch->id))
            ->actingAs($this->user)
            ->postJson(route('assetLocations.store'), [
                'branch_id'     => $this->branchB->id,
                'location_name' => 'Lokasi B via Main',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('asset_locations', ['location_name' => 'Lokasi B via Main', 'branch_id' => $this->branchB->id]);
    }
}
