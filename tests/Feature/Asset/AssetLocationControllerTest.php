<?php

namespace Tests\Feature\Asset;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetLocation;
use App\Models\Core\Branch;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AssetLocationControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);
    }

    private function permissions(): array {
        return [
            'permissions' => [
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
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    private function createBranch(): Branch {
        return Branch::create([
            'code'            => Str::upper(Str::random(6)),
            'name'            => 'Main Branch',
            'branchable_type' => null,
            'branchable_id'   => null,
            'is_main_branch'  => true,
            'is_disabled'     => false,
        ]);
    }

    /**
     * [FIXED] AssetLocationRequest::rules() sekarang memvalidasi branch_id
     * (required, exists:branches) — AssetLocation bisa dibuat lewat HTTP.
     */
    public function test_store_creates_asset_location(): void {
        $user   = User::factory()->create();
        $branch = $this->createBranch();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetLocations.store'), [
                'location_name' => 'Gudang Utama',
                'branch_id'     => $branch->id,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_locations', [
            'location_name' => 'Gudang Utama',
            'branch_id'     => $branch->id,
        ]);
    }

    public function test_store_requires_branch_id(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetLocations.store'), [
                'location_name' => 'Gudang Tanpa Cabang',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['branch_id']);
    }

    public function test_store_requires_location_name(): void {
        $user   = User::factory()->create();
        $branch = $this->createBranch();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetLocations.store'), [
                'branch_id' => $branch->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['location_name']);
    }

    public function test_update_modifies_existing_location(): void {
        $user     = User::factory()->create();
        $location = AssetLocation::factory()->create(['location_name' => 'Lama']);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assetLocations.update', $location), [
                'location_name' => 'Baru',
                'branch_id'     => $location->branch_id,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_locations', [
            'id'            => $location->id,
            'location_name' => 'Baru',
        ]);
    }
}
