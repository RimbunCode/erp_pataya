<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetCompleteDataControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        foreach ([FormatingSeries::class, Asset::class] as $model) {
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

    public function test_completes_data_in_single_mode(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 1,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'           => 'single',
                'asset_category' => ['id' => $category->id],
                'asset_location' => ['id' => $location->id],
            ])
            ->assertRedirect();

        $asset->refresh();
        $this->assertEquals($category->id, $asset->asset_category_id);
        $this->assertEquals($location->id, $asset->asset_location_id);
        $this->assertEquals(1, $asset->asset_quantity, 'asset_quantity tidak boleh berubah pada mode single.');
    }

    public function test_completes_data_in_split_mode_creates_multiple_assets_with_distinct_category_location(): void {
        $user      = User::factory()->create();
        $categoryA = AssetCategory::factory()->create();
        $categoryB = AssetCategory::factory()->create();
        $locationA = AssetLocation::factory()->create();
        $asset     = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 5,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode' => 'split',
                'rows' => [
                    ['asset_category' => ['id' => $categoryA->id], 'asset_location' => ['id' => $locationA->id], 'quantity' => 3],
                    ['asset_category' => ['id' => $categoryB->id], 'asset_location' => ['id' => $locationA->id], 'quantity' => 2],
                ],
            ])
            ->assertRedirect();

        $this->assertSoftDeleted($asset);
        $this->assertEquals(1, Asset::where('asset_category_id', $categoryA->id)->count());
        $this->assertEquals(1, Asset::where('asset_category_id', $categoryB->id)->count());
    }

    public function test_rejects_completion_when_asset_already_submitted(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => $location->id,
            'status'            => [FormStatus::SUBMITTED],
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'           => 'single',
                'asset_category' => ['id' => $category->id],
                'asset_location' => ['id' => $location->id],
            ])
            ->assertStatus(422);
    }

    public function test_rejects_split_rows_quantity_mismatch(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'asset_quantity'    => 3,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode' => 'split',
                'rows' => [
                    ['asset_category' => ['id' => $category->id], 'asset_location' => ['id' => $location->id], 'quantity' => 5],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rows']);
    }

    public function test_rejects_missing_category_or_location_in_single_mode(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), ['mode' => 'single'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_category_id', 'asset_location_id']);
    }
}
