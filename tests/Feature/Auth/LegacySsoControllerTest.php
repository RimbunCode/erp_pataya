<?php

namespace Tests\Feature\Auth;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacySsoControllerTest extends TestCase {
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

        config(['services.legacy_sso.secret' => 'test-secret']);
        config(['services.legacy_sso.ttl_seconds' => 60]);
    }

    private function signedToken(string $email, int $expiresInSeconds = 60, ?string $secret = null, ?string $jti = null): string {
        $payload   = $email . '|' . (time() + $expiresInSeconds) . '|' . ($jti ?? Str::uuid()->toString());
        $signature = hash_hmac('sha256', $payload, $secret ?? 'test-secret');

        return base64_encode($payload) . '.' . $signature;
    }

    public function test_valid_token_logs_in_existing_active_user(): void {
        $user = User::factory()->create([
            'email'  => 'active@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        $response = $this->post('/auth/legacy-sso', ['token' => $this->signedToken('active@example.com')]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_token_can_only_be_used_once(): void {
        User::factory()->create([
            'email'  => 'replay@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        $token = $this->signedToken('replay@example.com');

        $this->post('/auth/legacy-sso', ['token' => $token]);
        $this->assertAuthenticated();

        Auth::guard('web')->logout();

        $response = $this->post('/auth/legacy-sso', ['token' => $token]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_expired_token_is_rejected(): void {
        User::factory()->create([
            'email'  => 'expired@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        $response = $this->post('/auth/legacy-sso', ['token' => $this->signedToken('expired@example.com', -10)]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_tampered_signature_is_rejected(): void {
        User::factory()->create([
            'email'  => 'tampered@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        $token = $this->signedToken('tampered@example.com', 60, 'wrong-secret');

        $response = $this->post('/auth/legacy-sso', ['token' => $token]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_malformed_token_is_rejected(): void {
        $response = $this->post('/auth/legacy-sso', ['token' => 'not-a-valid-token']);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_unknown_email_is_rejected(): void {
        $response = $this->post('/auth/legacy-sso', ['token' => $this->signedToken('unknown@example.com')]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_inactive_user_is_rejected(): void {
        User::factory()->create([
            'email'  => 'inactive@example.com',
            'status' => FormStatus::INACTIVE,
        ]);

        $response = $this->post('/auth/legacy-sso', ['token' => $this->signedToken('inactive@example.com')]);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_endpoint_is_reachable_without_a_csrf_token(): void {
        // withoutMiddleware() in setUp() doesn't touch CSRF, but Laravel's
        // test HTTP helpers bypass ValidateCsrfToken globally unless it's
        // explicitly re-enabled — do that here so this test actually
        // proves the bootstrap/app.php validateCsrfTokens(except:) exclusion
        // works, instead of passing for the wrong reason.
        $this->withMiddleware(ValidateCsrfToken::class);

        User::factory()->create([
            'email'  => 'no-csrf@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        $response = $this->post('/auth/legacy-sso', ['token' => $this->signedToken('no-csrf@example.com')]);

        $response->assertStatus(302);
        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();
    }

    public function test_ttl_is_capped_server_side_regardless_of_claimed_expiry(): void {
        User::factory()->create([
            'email'  => 'longlived@example.com',
            'status' => FormStatus::ACTIVE,
        ]);

        config(['services.legacy_sso.ttl_seconds' => 60]);

        // Legacy app claims a 1-hour expiry; server must cap it to 60s and
        // therefore still accept it immediately (cap only shortens, it
        // doesn't reject on its own — this proves the signed value is
        // clamped rather than trusted verbatim).
        $token = $this->signedToken('longlived@example.com', 3600);

        $response = $this->post('/auth/legacy-sso', ['token' => $token]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }
}
