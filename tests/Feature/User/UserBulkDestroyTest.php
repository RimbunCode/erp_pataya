<?php

namespace Tests\Feature\User;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserBulkDestroyTest extends TestCase {
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

    /**
     * Permission session untuk User (delete diizinkan).
     *
     * @return array<string, mixed>
     */
    private function permissions(): array {
        return [
            'permissions' => [
                User::class => [
                    0 => [
                        [
                            'model'        => User::class,
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

    public function test_single_destroy_requires_password(): void {
        $actor  = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroy', $target->id))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'deleted_at' => null]);
    }

    public function test_single_destroy_deletes_user_with_correct_password(): void {
        $actor  = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroy', $target->id), ['password' => 'password'])
            ->assertRedirect(route('users.index'));

        $this->assertSoftDeleted($target);
    }

    public function test_bulk_destroy_requires_password(): void {
        $actor = User::factory()->create();
        $a     = User::factory()->create();
        $b     = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroyMany'), ['ids' => [$a->id, $b->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->assertNotSoftDeleted($a);
        $this->assertNotSoftDeleted($b);
    }

    public function test_bulk_destroy_deletes_users_with_correct_password(): void {
        $actor = User::factory()->create();
        $a     = User::factory()->create();
        $b     = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroyMany'), [
                'ids'      => [$a->id, $b->id],
                'password' => 'password',
            ])
            ->assertRedirect(route('users.index'));

        $this->assertSoftDeleted($a);
        $this->assertSoftDeleted($b);
    }

    public function test_single_destroy_with_wrong_password_deletes_nothing(): void {
        $actor  = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroy', $target->id), ['password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->assertNotSoftDeleted($target);
        $this->assertAuthenticatedAs($actor);
    }

    public function test_single_self_delete_logs_out_and_redirects_home(): void {
        $actor = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroy', $actor->id), ['password' => 'password'])
            ->assertRedirect('/');

        $this->assertGuest();
        $this->assertSoftDeleted($actor);
    }

    public function test_bulk_delete_including_self_logs_out_and_redirects_home(): void {
        $actor = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroyMany'), [
                'ids'      => [$actor->id, $other->id],
                'password' => 'password',
            ])
            ->assertRedirect('/');

        $this->assertGuest();
        $this->assertSoftDeleted($actor);
        $this->assertSoftDeleted($other);
    }

    public function test_bulk_delete_excluding_self_keeps_session(): void {
        $actor = User::factory()->create();
        $a     = User::factory()->create();

        $this->actingAs($actor)
            ->withSession($this->permissions())
            ->deleteJson(route('users.destroyMany'), [
                'ids'      => [$a->id],
                'password' => 'password',
            ])
            ->assertRedirect(route('users.index'));

        $this->assertAuthenticatedAs($actor);
        $this->assertSoftDeleted($a);
    }
}
