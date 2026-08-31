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
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseReceipt;
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

    /**
     * FK purchase_receipt_id di assets tabel enforced (SQLite :memory: aktif
     * foreign_keys) — butuh record PurchaseReceipt beneran, bukan ULID acak.
     */
    private function makePurchaseReceipt(User $user): PurchaseReceipt {
        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'          => 'PR-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));
    }

    public function test_completes_data_in_single_mode(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $receipt  = $this->makePurchaseReceipt($user);
        $asset    = Asset::factory()->create([
            'asset_category_id'   => null,
            'asset_location_id'   => null,
            'asset_quantity'      => 1,
            'purchase_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'                 => 'single',
                'source_document_type' => 'purchase_receipt',
                'source_document_id'   => $asset->purchase_receipt_id,
                'asset_category'       => ['id' => $category->id],
                'asset_location'       => ['id' => $location->id],
            ])
            ->assertRedirect();

        $asset->refresh();
        $this->assertEquals($category->id, $asset->asset_category_id);
        $this->assertEquals($location->id, $asset->asset_location_id);
        $this->assertEquals(1, $asset->asset_quantity, 'asset_quantity tidak boleh berubah pada mode single.');
    }

    public function test_completes_data_in_split_mode_creates_multiple_assets_with_distinct_category_location(): void {
        $user      = User::factory()->create();
        $categoryA = AssetCategory::factory()->bulkQuantity()->create();
        $categoryB = AssetCategory::factory()->bulkQuantity()->create();
        $locationA = AssetLocation::factory()->create();
        $receipt   = $this->makePurchaseReceipt($user);
        $asset     = Asset::factory()->create([
            'asset_category_id'   => null,
            'asset_location_id'   => null,
            'asset_quantity'      => 5,
            'purchase_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'                 => 'split',
                'source_document_type' => 'purchase_receipt',
                'source_document_id'   => $asset->purchase_receipt_id,
                'rows'                 => [
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
        $receipt  = $this->makePurchaseReceipt($user);
        $asset    = Asset::factory()->create([
            'asset_category_id'   => $category->id,
            'asset_location_id'   => $location->id,
            'status'              => [FormStatus::SUBMITTED],
            'purchase_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'                 => 'single',
                'source_document_type' => 'purchase_receipt',
                'source_document_id'   => $asset->purchase_receipt_id,
                'asset_category'       => ['id' => $category->id],
                'asset_location'       => ['id' => $location->id],
            ])
            ->assertStatus(422);
    }

    public function test_rejects_split_rows_quantity_mismatch(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $receipt  = $this->makePurchaseReceipt($user);
        $asset    = Asset::factory()->create([
            'asset_category_id'   => null,
            'asset_location_id'   => null,
            'asset_quantity'      => 3,
            'purchase_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'                 => 'split',
                'source_document_type' => 'purchase_receipt',
                'source_document_id'   => $asset->purchase_receipt_id,
                'rows'                 => [
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
            ->assertJsonValidationErrors(['asset_category_id', 'asset_location_id', 'source_document_type', 'source_document_id']);
    }

    /**
     * Requirement 6.6: aksi ini hanya boleh dipakai dari halaman dokumen
     * Purchase yang benar-benar jadi sumber Asset tersebut — mencegah user
     * melengkapi Asset milik dokumen lain lewat manipulasi request langsung.
     */
    public function test_rejects_completion_when_source_document_does_not_match(): void {
        $user         = User::factory()->create();
        $category     = AssetCategory::factory()->create();
        $location     = AssetLocation::factory()->create();
        $receipt      = $this->makePurchaseReceipt($user);
        $otherReceipt = $this->makePurchaseReceipt($user);
        $asset        = Asset::factory()->create([
            'asset_category_id'   => null,
            'asset_location_id'   => null,
            'purchase_receipt_id' => $receipt->id,
        ]);

        $this->actingAs($user)
            ->putJson(route('assets.completeData', $asset), [
                'mode'                 => 'single',
                'source_document_type' => 'purchase_receipt',
                'source_document_id'   => $otherReceipt->id, // beda dari asset->purchase_receipt_id
                'asset_category'       => ['id' => $category->id],
                'asset_location'       => ['id' => $location->id],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['source_document_id']);

        $asset->refresh();
        $this->assertNull($asset->asset_category_id, 'Asset tidak boleh berubah kalau source document tidak cocok.');
    }
}
