<?php

namespace Tests\Feature\Auth;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use App\Models\User\UserProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class AuthenticatedSessionControllerProviderCallbackTest extends TestCase {
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

    private function fakeSocialiteUser(string $id, string $email, string $name = 'Google User'): void {
        $socialiteUser = Mockery::mock(SocialiteUserContract::class);
        $socialiteUser->shouldReceive('getId')->andReturn($id);
        $socialiteUser->shouldReceive('getEmail')->andReturn($email);
        $socialiteUser->shouldReceive('getName')->andReturn($name);
        $socialiteUser->shouldReceive('getAvatar')->andReturn('https://example.com/avatar.png');
        $socialiteUser->token        = 'access-token';
        $socialiteUser->refreshToken = 'refresh-token';
        $socialiteUser->expiresIn    = 3600;

        Socialite::shouldReceive('driver->user')->andReturn($socialiteUser);
    }

    public function test_login_fails_without_leaving_a_row_when_existing_user_has_no_password(): void {
        User::factory()->create([
            'email'    => 'nopass@example.com',
            'password' => null,
        ]);

        $this->fakeSocialiteUser('google-1', 'nopass@example.com');

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
        $this->assertSame(1, User::count());
        $this->assertSame(0, UserProvider::count());
    }

    public function test_login_fails_without_leaving_a_row_when_existing_user_is_inactive(): void {
        User::factory()->create([
            'email'    => 'inactive@example.com',
            'password' => 'hashed',
            'status'   => FormStatus::INACTIVE,
        ]);

        $this->fakeSocialiteUser('google-2', 'inactive@example.com');

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
        $this->assertSame(1, User::count());
        $this->assertSame(0, UserProvider::count());
    }

    public function test_new_oauth_user_is_created_and_redirected_to_setup(): void {
        $this->fakeSocialiteUser('google-3', 'brandnew@example.com', 'Brand New');

        $response = $this->get('/auth/google/callback');

        $this->assertAuthenticated();
        $response->assertRedirect(route('setup.show'));

        $user = User::where('email', 'brandnew@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame(FormStatus::PRE_REGISTERED, $user->status);
        $this->assertSame(1, UserProvider::where('user_id', $user->id)->where('provider', 'google')->count());
    }

    public function test_existing_active_user_logs_in_and_redirects_to_dashboard(): void {
        $user = User::factory()->create([
            'email'    => 'active@example.com',
            'password' => 'hashed',
            'status'   => FormStatus::ACTIVE,
        ]);

        $this->fakeSocialiteUser('google-4', 'active@example.com');

        $response = $this->get('/auth/google/callback');

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect(route('desks.index', absolute: false));
    }

    public function test_existing_active_user_login_via_provider_verifies_email(): void {
        $user = User::factory()->unverified()->create([
            'email'    => 'unverified-login@example.com',
            'password' => 'hashed',
            'status'   => FormStatus::ACTIVE,
        ]);

        $this->fakeSocialiteUser('google-6', 'unverified-login@example.com');

        $this->get('/auth/google/callback');

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_connecting_provider_to_current_session_verifies_email(): void {
        $current = User::factory()->unverified()->create();
        Auth::login($current);

        $this->fakeSocialiteUser('google-7', 'someone-else2@example.com');

        $this->get('/auth/google/callback');

        $this->assertNotNull($current->fresh()->email_verified_at);
    }

    public function test_connecting_provider_with_email_already_registered_to_another_user_fails(): void {
        $emailOwner = User::factory()->create([
            'email' => 'taken@example.com',
        ]);

        $current = User::factory()->create([
            'email' => 'current@example.com',
        ]);
        Auth::login($current);

        $this->fakeSocialiteUser('google-8', 'taken@example.com');

        $response = $this->get('/auth/google/callback');

        $response->assertSessionHasErrors('provider_account');
        $this->assertSame(0, UserProvider::where('user_id', $current->id)->count());
        $this->assertSame(0, UserProvider::where('provider_id', 'google-8')->count());
        $this->assertNotNull($emailOwner->fresh());
    }

    public function test_connecting_provider_with_own_email_succeeds(): void {
        $current = User::factory()->create([
            'email' => 'own-email@example.com',
        ]);
        Auth::login($current);

        $this->fakeSocialiteUser('google-9', 'own-email@example.com');

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect(route('users.show', $current->id));
        $this->assertSame(1, UserProvider::where('user_id', $current->id)->where('provider_id', 'google-9')->count());
    }

    public function test_registering_via_provider_with_email_of_existing_user_links_account(): void {
        $existing = User::factory()->create([
            'email'    => 'link-me@example.com',
            'password' => 'hashed',
            'status'   => FormStatus::ACTIVE,
        ]);

        $this->fakeSocialiteUser('google-10', 'link-me@example.com');

        $response = $this->get('/auth/google/callback');

        $this->assertAuthenticatedAs($existing);
        $response->assertRedirect(route('desks.index', absolute: false));
        $this->assertSame(1, User::where('email', 'link-me@example.com')->count());
        $this->assertSame(1, UserProvider::where('user_id', $existing->id)->where('provider_id', 'google-10')->count());
    }

    public function test_connecting_already_connected_provider_fails_without_dangling_transaction(): void {
        $owner = User::factory()->create();
        UserProvider::create([
            'provider'    => 'google',
            'provider_id' => 'google-5',
            'user_id'     => $owner->id,
            'avatar_url'  => null,
            'token'       => 'x',
        ]);

        $current = User::factory()->create();
        Auth::login($current);

        $this->fakeSocialiteUser('google-5', 'someone-else@example.com');

        $this->get('/auth/google/callback')->assertStatus(302);

        // Transaction must not be left open — a subsequent write must succeed normally.
        $another = User::factory()->create();
        $this->assertNotNull($another->id);
    }
}
