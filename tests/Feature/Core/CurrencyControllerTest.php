<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Currency;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CurrencyControllerTest extends TestCase {
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
                Currency::class => [
                    0 => [
                        [
                            'model'        => Currency::class,
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

    public function test_index_returns_ok(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('currencies.index'))
            ->assertOk();
    }

    public function test_store_creates_currency(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('currencies.store'), [
                'code'   => 'IDR',
                'name'   => 'Indonesian Rupiah',
                'symbol' => 'Rp',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('currencies', [
            'code'   => 'IDR',
            'name'   => 'Indonesian Rupiah',
            'symbol' => 'Rp',
        ]);
    }

    public function test_show_returns_currency(): void {
        $currency = Currency::factory()->create(['code' => 'USD']);
        $user     = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('currencies.show', $currency->code))
            ->assertOk();
    }

    public function test_update_modifies_currency(): void {
        $currency = Currency::factory()->create(['code' => 'EUR', 'name' => 'Euro']);
        $user     = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('currencies.update', $currency->code), [
                'code'   => 'EUR',
                'name'   => 'Euro (Updated)',
                'symbol' => '€',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('currencies', ['code' => 'EUR', 'name' => 'Euro (Updated)']);
    }

    public function test_destroy_deletes_currency(): void {
        $currency = Currency::factory()->create(['code' => 'GBP']);
        $user     = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('currencies.destroy', $currency->code))
            ->assertRedirect();

        $this->assertDatabaseMissing('currencies', ['code' => 'GBP']);
    }

    public function test_store_requires_code_and_name(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('currencies.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'name']);
    }
}
