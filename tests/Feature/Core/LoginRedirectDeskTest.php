<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Models\Core\Desk;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginRedirectDeskTest extends TestCase {
    use RefreshDatabase;

    public function test_login_redirects_to_dashboard_when_default_desk_valid(): void {
        $user = User::factory()->create(['password' => bcrypt('password')]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $response = $this->withCookie('lang', 'en')
            ->post('/login', [
                'usernameOrEmail' => $user->username,
                'password'        => 'password',
            ]);

        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_login_redirects_to_desks_index_when_no_default_desk(): void {
        $user = User::factory()->create(['password' => bcrypt('password'), 'default_desk_id' => null]);

        $response = $this->withCookie('lang', 'en')
            ->post('/login', [
                'usernameOrEmail' => $user->username,
                'password'        => 'password',
            ]);

        $response->assertRedirect(route('desks.index', absolute: false));
    }

    public function test_login_redirects_to_desks_index_when_default_desk_not_visible(): void {
        $user      = User::factory()->create(['password' => bcrypt('password')]);
        $otherUser = User::factory()->create();
        $desk      = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $otherUser->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $response = $this->withCookie('lang', 'en')
            ->post('/login', [
                'usernameOrEmail' => $user->username,
                'password'        => 'password',
            ]);

        $response->assertRedirect(route('desks.index', absolute: false));
    }
}
