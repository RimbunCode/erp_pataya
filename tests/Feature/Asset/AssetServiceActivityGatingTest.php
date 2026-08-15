<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetServiceType;
use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetServiceActivityGatingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach ([FormatingSeries::class, Asset::class, AssetService::class] as $model) {
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
                AssetService::class => [
                    0 => [
                        [
                            'model'        => AssetService::class,
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

    public function test_creating_activity_on_draft_service_is_rejected(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'test',
            ])
            ->assertStatus(500);
    }

    public function test_creating_activity_on_approved_service_is_accepted(): void {
        $user    = User::factory()->create();
        $asset   = Asset::factory()->create();
        $service = AssetService::factory()->create([
            'type'     => AssetServiceType::REPAIR,
            'asset_id' => $asset->id,
            'status'   => [FormStatus::APPROVED],
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assetServices.activities.store', $service), [
                'action_date' => now()->toDateTimeString(),
                'description' => 'test',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_service_activities', [
            'asset_service_id' => $service->id,
            'description'      => 'test',
        ]);
    }
}
