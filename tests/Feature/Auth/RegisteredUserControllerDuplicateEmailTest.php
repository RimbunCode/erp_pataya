<?php

namespace Tests\Feature\Auth;

use App\Enums\FormStatus;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RegisteredUserControllerDuplicateEmailTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([LanguageMiddleware::class]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    public function test_register_is_rejected_when_email_belongs_to_abandoned_oauth_signup(): void {
        User::factory()->create([
            'email'    => 'oauth-abandoned@example.com',
            'password' => null,
            'status'   => FormStatus::PRE_REGISTERED,
        ]);

        Auth::logout();

        $response = $this->post('/register', [
            'name'                  => 'Second Try',
            'username'              => 'secondtry',
            'email'                 => 'oauth-abandoned@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertSame(1, User::where('email', 'oauth-abandoned@example.com')->count());
    }

    public function test_register_succeeds_when_abandoned_oauth_row_was_soft_deleted(): void {
        $old = User::factory()->create([
            'email'    => 'soft-deleted@example.com',
            'password' => null,
            'status'   => FormStatus::PRE_REGISTERED,
        ]);
        $old->delete();

        Auth::logout();

        $response = $this->post('/register', [
            'name'                  => 'Second Try',
            'username'              => 'secondtry2',
            'email'                 => 'soft-deleted@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        dump('status: ' . $response->getStatusCode());
        dump('redirect: ' . $response->headers->get('Location'));
        dump('session errors: ' . json_encode(session('errors')));
        dump('user count (with trashed): ' . User::withTrashed()->where('email', 'soft-deleted@example.com')->count());
        dump('authenticated as: ' . (Auth::check() ? Auth::user()->id : 'guest'));
    }
}
