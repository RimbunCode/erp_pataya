<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetMovementItem;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetMovementControllerCreateRedirectTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach ([FormatingSeries::class, Asset::class, AssetMovement::class] as $model) {
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
                AssetMovement::class => [
                    0 => [
                        [
                            'model'        => AssetMovement::class,
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

    public function test_redirects_to_existing_draft_when_same_user_and_same_asset(): void {
        $user     = User::factory()->create();
        $asset    = Asset::factory()->create();
        $movement = AssetMovement::factory()->create([
            'status'        => [FormStatus::DRAFT],
            'created_by_id' => $user->id,
        ]);
        AssetMovementItem::factory()->create([
            'asset_movement_id' => $movement->id,
            'asset_id'          => $asset->id,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('assetMovements.create', ['asset_id' => $asset->id]))
            ->assertRedirect(route('assetMovements.show', $movement));
    }

    public function test_does_not_redirect_when_draft_belongs_to_different_user(): void {
        $owner    = User::factory()->create();
        $other    = User::factory()->create();
        $asset    = Asset::factory()->create();
        $movement = AssetMovement::factory()->create([
            'status'        => [FormStatus::DRAFT],
            'created_by_id' => $owner->id,
        ]);
        AssetMovementItem::factory()->create([
            'asset_movement_id' => $movement->id,
            'asset_id'          => $asset->id,
        ]);

        $this->actingAs($other)
            ->withSession($this->permissions())
            ->get(route('assetMovements.create', ['asset_id' => $asset->id]))
            ->assertOk();
    }

    public function test_does_not_redirect_when_no_existing_draft(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->get(route('assetMovements.create', ['asset_id' => $asset->id]))
            ->assertOk();
    }
}
