<?php

namespace Tests\Feature\Auth;

use App\Enums\FormStatus;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LoginRequestTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            LanguageMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    public function test_login_with_nonexistent_username_returns_validation_error_not_500(): void {
        $response = $this->post('/login', [
            'usernameOrEmail' => 'testqa',
            'password'        => 'whatever-password',
        ]);

        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_login_with_nonexistent_email_returns_validation_error_not_500(): void {
        $response = $this->post('/login', [
            'usernameOrEmail' => 'nobody@example.com',
            'password'        => 'whatever-password',
        ]);

        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }

    public function test_login_with_correct_credentials_succeeds(): void {
        $user = User::factory()->create([
            'username' => 'testqa',
            'status'   => FormStatus::ACTIVE,
        ]);

        $response = $this->post('/login', [
            'usernameOrEmail' => 'testqa',
            'password'        => 'password',
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($user);
    }

    public function test_login_with_inactive_user_returns_validation_error(): void {
        User::factory()->create([
            'username' => 'testqa',
            'status'   => FormStatus::INACTIVE,
        ]);

        $response = $this->post('/login', [
            'usernameOrEmail' => 'testqa',
            'password'        => 'password',
        ]);

        $response->assertSessionHasErrors('status');
        $this->assertGuest();
    }
}
