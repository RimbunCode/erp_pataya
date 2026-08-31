<?php

namespace Tests\Feature\Core;

use App\Models\Core\Desk;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeskAssignableTest extends TestCase {
    use RefreshDatabase;

    public function test_can_create_mixed_role_and_user_assignables(): void {
        $desk = Desk::factory()->create();
        $user = User::factory()->create();
        $role = Role::create(['name' => 'assignable-role-' . uniqid()]);

        $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $user->id]);
        $desk->assignables()->create(['assignable_type' => 'role', 'assignable_id' => $role->id]);

        $this->assertSame(2, $desk->assignables()->count());
    }

    public function test_assignable_belongs_to_desk(): void {
        $desk       = Desk::factory()->create();
        $user       = User::factory()->create();
        $assignable = $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $user->id]);

        $this->assertSame($desk->id, $assignable->desk->id);
    }

    public function test_duplicate_assignable_violates_unique_constraint(): void {
        $desk = Desk::factory()->create();
        $user = User::factory()->create();

        $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $user->id]);

        $this->expectException(QueryException::class);
        $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $user->id]);
    }
}
