<?php

namespace Tests\Feature;

use Exception;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ErrorPageTest extends TestCase {
    private const ERROR_ROUTE = '/_test/error-page';

    protected function setUp(): void {
        parent::setUp();

        Route::middleware('web')->get(self::ERROR_ROUTE, function () {
            throw new Exception('Test exception for error page.');
        });
    }

    private function fakeAuthenticatedUser(): Authenticatable {
        return new class implements Authenticatable
        {
            public function getAuthIdentifierName(): string {
                return 'id';
            }

            public function getAuthIdentifier(): int {
                return 1;
            }

            public function getAuthPasswordName(): string {
                return 'password';
            }

            public function getAuthPassword(): string {
                return '';
            }

            public function getRememberToken(): ?string {
                return null;
            }

            public function setRememberToken($value): void {
                //
            }

            public function getRememberTokenName(): string {
                return 'remember_token';
            }

            public function toArray(): array {
                return [
                    'id'   => 1,
                    'name' => 'Test User',
                ];
            }

            public function idRoles(): object {
                return new class
                {
                    public function pluck(string $column): Collection {
                        return collect([]);
                    }
                };
            }
        };
    }

    public function test_authenticated_user_gets_inertia_error_page_when_debug_is_disabled(): void {
        config()->set('app.debug', false);

        $response = $this->actingAs($this->fakeAuthenticatedUser())
            ->get(self::ERROR_ROUTE);

        $response->assertStatus(500);
        $response->assertSee('&quot;component&quot;:&quot;Error&quot;', escape: false);
        $response->assertSee('&quot;useAppLayout&quot;:true', escape: false);
    }

    public function test_guest_user_gets_default_error_response_when_debug_is_disabled(): void {
        config()->set('app.debug', false);

        $response = $this->get(self::ERROR_ROUTE);

        $response->assertStatus(500);
        $response->assertDontSee('"component":"Error"', escape: false);
    }

    public function test_custom_error_page_is_disabled_when_debug_is_enabled(): void {
        config()->set('app.debug', true);

        $response = $this->actingAs($this->fakeAuthenticatedUser())
            ->get(self::ERROR_ROUTE);

        $response->assertStatus(500);
        $response->assertSee('Test exception for error page.', escape: false);
    }
}
