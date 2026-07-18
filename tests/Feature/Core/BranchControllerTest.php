<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BranchControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    private function makeUser(): User {
        return User::factory()->create();
    }

    private function permissions(): array {
        return [
            'permissions' => [
                Branch::class => [
                    0 => [
                        [
                            'model'        => Branch::class,
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

    public function test_store_creates_system_branch_without_billing_address(): void {
        $country = Country::factory()->create();
        $user    = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('branches.store'), [
                'code'              => 'BR-01',
                'name'              => 'Branch One',
                'shipping_street'   => 'Jl. Sudirman No. 10',
                'shipping_city'     => 'Jakarta Selatan',
                'shipping_state'    => 'DKI Jakarta',
                'shipping_zip_code' => '12190',
                'shipping_country'  => ['code' => $country->code],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('branches', [
            'code'            => 'BR-01',
            'name'            => 'Branch One',
            'billing_address' => null,
        ]);
    }

    public function test_store_requires_billing_address_when_branchable_type_present(): void {
        $country = Country::factory()->create();
        $user    = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('branches.store'), [
                'code'              => 'BR-02',
                'name'              => 'Branch Two',
                'branchable_type'   => 'App\\Models\\Sales\\Customer',
                'shipping_street'   => 'Jl. Asia Afrika No. 8',
                'shipping_city'     => 'Bandung',
                'shipping_state'    => 'Jawa Barat',
                'shipping_zip_code' => '40111',
                'shipping_country'  => ['code' => $country->code],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_address']);
    }
}
