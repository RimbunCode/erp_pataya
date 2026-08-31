<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\Asset;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Requirement 3.1 (asset-rental-migration): tombol/aksi "Jual" manual di
 * halaman Asset (di luar alur SO->DN->SI) harus memanggil Asset::sell()
 * yang sudah diimplementasikan, bukan lagi stub LogicException.
 */
class AssetSellActionTest extends TestCase {
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

    public function test_sell_action_marks_full_quantity_sold(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create([
            'status'          => [FormStatus::ACTIVE],
            'asset_quantity'  => 1,
            'sold_quantity'   => 0,
            'rental_quantity' => 0,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->post(route('assets.action', [$asset, 'sell']))
            ->assertRedirect();

        $asset->refresh();
        $this->assertEquals(1, (float) $asset->sold_quantity);
        $this->assertContains(FormStatus::SOLD, $asset->status);
        $this->assertNotNull($asset->disposal_date);
    }

    public function test_action_route_rejects_user_without_write_permission(): void {
        $user  = User::factory()->create();
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $noWritePermissions = [
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
                                'write'  => false,
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $this->actingAs($user)
            ->withSession($noWritePermissions)
            ->post(route('assets.action', [$asset, 'sell']))
            ->assertForbidden();
    }
}
