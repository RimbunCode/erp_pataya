<?php

namespace Tests\Feature\Asset;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetCategory;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetCategoryControllerTest extends TestCase {
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
                AssetCategory::class => [
                    0 => [
                        [
                            'model'        => AssetCategory::class,
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

    public function test_store_creates_asset_category(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetCategories.store'), [
                'category_name'            => 'Kendaraan',
                'non_depreciable_category' => false,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_categories', [
            'category_name' => 'Kendaraan',
        ]);
    }

    public function test_store_requires_category_name(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assetCategories.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category_name']);
    }

    public function test_update_modifies_existing_category(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create(['category_name' => 'Lama']);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assetCategories.update', $category), [
                'category_name' => 'Baru',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('asset_categories', [
            'id'            => $category->id,
            'category_name' => 'Baru',
        ]);
    }
}
