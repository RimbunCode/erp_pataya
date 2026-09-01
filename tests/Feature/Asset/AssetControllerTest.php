<?php

namespace Tests\Feature\Asset;

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
use Illuminate\Support\Str;
use Tests\TestCase;

class AssetControllerTest extends TestCase {
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

    /**
     * AssetService::create()/update() memakai DB::beginTransaction() manual TANPA
     * try/catch + rollback (bug produksi terpisah — lihat catatan di
     * test_store_fails_due_to_missing_code_on_create). Ketika exception terjadi
     * di dalam transaksi itu, transaksi tertinggal terbuka dan merusak test
     * berikutnya ("cannot start a transaction within a transaction"). Rollback
     * paksa di sini murni test hygiene — TIDAK menutupi bug produksinya, yang
     * tetap perlu diperbaiki di AssetService itu sendiri.
     */
    protected function tearDown(): void {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        parent::tearDown();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                Asset::class => [
                    0 => [
                        [
                            'model'        => Asset::class,
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

    /**
     * [FIXED] Sebelumnya AssetService::create() tidak pernah mengisi `code`
     * (kolom NOT NULL) — cuma diisi di submit(). Sekarang create() memanggil
     * FormatingSeries::generate(Asset::class, $data, true) untuk kode DRAFT
     * (isDraft=true, nomor urut terpisah dari kode final submit), sesuai
     * keputusan desain: kode draft di create(), kode final di submit().
     */
    public function test_store_creates_asset_with_draft_code(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'            => 'Toyota Avanza B 1234 XYZ',
                'asset_category'        => ['id' => $category->id],
                'asset_location'        => ['id' => $location->id],
                'asset_quantity'        => 1,
                'ownership_type'        => 'company',
                'ownership_company_id'  => (string) Str::ulid(),
                'gross_purchase_amount' => 250_000_000,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('assets', [
            'asset_name' => 'Toyota Avanza B 1234 XYZ',
        ]);

        $asset = Asset::where('asset_name', 'Toyota Avanza B 1234 XYZ')->firstOrFail();
        $this->assertNotEmpty($asset->code);
    }

    public function test_store_requires_asset_name_and_category_and_location(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_name', 'asset_category.id', 'asset_location.id']);
    }

    public function test_update_modifies_existing_asset(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create(['asset_name' => 'Lama']);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assets.update', $asset), [
                'asset_name'     => 'Baru',
                'asset_category' => ['id' => $asset->asset_category_id],
                'asset_location' => ['id' => $asset->asset_location_id],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('assets', [
            'id'         => $asset->id,
            'asset_name' => 'Baru',
        ]);
    }

    /**
     * [FIXED] AssetRequest sekarang memvalidasi ownership exclusivity
     * (Requirement 4.3-4.5) via withValidator() — ownership_type=supplier tanpa
     * ownership_supplier_id sekarang ditolak HTTP 422, bukan lolos ke model.
     */
    public function test_ownership_exclusivity_rejected_at_request_level(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('assets.update', $asset), [
                'asset_name'     => $asset->asset_name,
                'asset_category' => ['id' => $asset->asset_category_id],
                'asset_location' => ['id' => $asset->asset_location_id],
                'ownership_type' => 'supplier',
                // ownership_supplier_id sengaja TIDAK diisi
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ownership_supplier_id']);
    }

    /**
     * [FIXED] AssetRequest sekarang memvalidasi asset_quantity=1 untuk kategori
     * is_rentable=true (Requirement 3.5) via withValidator() — ditolak HTTP 422
     * rapi, bukan LogicException dari model hook.
     */
    public function test_rentable_quantity_rejected_at_request_level(): void {
        $user     = User::factory()->create();
        $category = AssetCategory::factory()->create(['is_rentable' => true]);
        $location = AssetLocation::factory()->create();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('assets.store'), [
                'asset_name'     => 'Excavator Banyak',
                'asset_category' => ['id' => $category->id],
                'asset_location' => ['id' => $location->id],
                'asset_quantity' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_quantity']);
    }
}
