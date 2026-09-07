<?php

namespace Tests\Unit\Models\User;

use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi: Role::users() sempat pakai nama pivot table 'user_roles' (plural),
 * padahal tabel yang benar-benar ada adalah 'user_role' (singular) — sama
 * seperti yang dipakai User::roles(). Sebelum fix, query lewat Role::users()
 * gagal dengan "no such table: user_roles".
 */
class RoleTest extends TestCase {
    use RefreshDatabase;

    public function test_users_returns_users_synced_via_user_roles_relation(): void {
        $role = Role::create(['name' => 'Test Role', 'is_disabled' => false]);
        $user = User::factory()->create();

        $user->roles()->sync([$role->id]);

        $this->assertTrue($role->users()->where('users.id', $user->id)->exists());
    }
}
