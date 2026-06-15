<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Country;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CountryControllerTest extends TestCase {
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
                Country::class => [
                    0 => [
                        [
                            'model'        => Country::class,
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
            ->getJson(route('countries.index'))
            ->assertOk();
    }

    public function test_store_creates_country(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('countries.store'), [
                'code' => 'ID',
                'name' => 'Republic of Indonesia',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('countries', ['code' => 'ID', 'name' => 'Republic of Indonesia']);
    }

    public function test_show_returns_country(): void {
        $country = Country::factory()->create(['code' => 'JP', 'name' => 'Japan']);
        $user    = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('countries.show', $country->code))
            ->assertOk();
    }

    public function test_update_modifies_country(): void {
        $country = Country::factory()->create(['code' => 'JP', 'name' => 'Japan']);
        $user    = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->putJson(route('countries.update', $country->code), [
                'code' => 'JP',
                'name' => 'Japan (Updated)',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('countries', ['code' => 'JP', 'name' => 'Japan (Updated)']);
    }

    public function test_destroy_deletes_country(): void {
        $country = Country::factory()->create(['code' => 'DE']);
        $user    = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->deleteJson(route('countries.destroy', $country->code))
            ->assertRedirect();

        $this->assertDatabaseMissing('countries', ['code' => 'DE']);
    }

    public function test_store_requires_code_and_name(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions())
            ->postJson(route('countries.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'name']);
    }
}
