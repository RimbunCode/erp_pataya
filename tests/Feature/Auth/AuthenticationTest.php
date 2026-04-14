<?php

namespace Tests\Feature\Auth;

use App\Models\User\User;
use App\Models\User\UserProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class AuthenticationTest extends TestCase {
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered(): void {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email'    => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void {
        $user = User::factory()->create();

        $this->post('/login', [
            'email'    => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_logout(): void {
        $user = User::factory()->create();

        $response = $this->withCookie('lang', 'en')->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
    }

    public function test_users_can_logout_when_remember_token_exists(): void {
        $user = User::factory()->create([
            'remember_token' => 'existing-remember-token',
        ]);

        $response = $this->withCookie('lang', 'en')->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
        $this->assertNotSame('existing-remember-token', $user->fresh()->remember_token);
    }

    public function test_socialite_callback_redirects_to_login_with_errors_when_user_has_no_password(): void {
        $user = User::factory()->create([
            'password' => null,
        ]);

        UserProvider::create([
            'provider'    => 'google',
            'provider_id' => 'google-user-id',
            'user_id'     => $user->id,
        ]);

        $socialiteUser = (new SocialiteUser)
            ->map([
                'id'     => 'google-user-id',
                'name'   => $user->name,
                'email'  => $user->email,
                'avatar' => 'https://example.com/avatar.jpg',
            ])
            ->setToken('token')
            ->setRefreshToken('refresh-token')
            ->setExpiresIn(3600);

        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('user')
            ->once()
            ->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->once()
            ->with('google')
            ->andReturn($provider);

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors(['status']);
        $this->assertGuest();
    }
}
