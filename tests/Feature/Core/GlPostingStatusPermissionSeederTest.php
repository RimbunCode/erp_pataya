<?php

namespace Tests\Feature\Core;

use App\Models\Core\GlPostingStatus;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Database\Seeders\GlPostingStatusPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GlPostingStatusPermissionSeederTest extends TestCase {
    use RefreshDatabase;

    public function test_grants_only_gl_read_and_retry_permissions_to_system_manager(): void {
        $manager = Role::create(['name' => 'System Manager']);
        $other   = Role::create(['name' => 'Purchasing Officer']);

        $this->seed(GlPostingStatusPermissionSeeder::class);

        $permission = Permission::where('model', GlPostingStatus::class)->firstOrFail();
        $grant      = RolePermission::where('role_id', $manager->id)->firstOrFail();
        $this->assertSame(['select', 'read', 'write'], $permission->permissions);
        $this->assertSame('gl-posting-statuses', $permission->getRawOriginal('route'));
        $this->assertSame($permission->id, $grant->permission_id);
        $this->assertSame(['select' => true, 'read' => true, 'write' => true], $grant->permissions);
        $this->assertFalse($grant->only_creator);
        $this->assertFalse(RolePermission::where('role_id', $other->id)->exists());
    }

    public function test_reseeding_is_idempotent_and_does_not_change_admin_credentials(): void {
        if (! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($table) => $table->boolean('is_example')->default(false));
        }
        Role::create(['name' => 'System Manager']);
        $admin            = User::factory()->create(['username' => 'admin']);
        $originalPassword = $admin->getRawOriginal('password');

        $this->seed(GlPostingStatusPermissionSeeder::class);
        $this->seed(GlPostingStatusPermissionSeeder::class);

        $this->assertSame(1, Permission::where('model', GlPostingStatus::class)->count());
        $this->assertSame(1, RolePermission::where('model', GlPostingStatus::class)->count());
        $this->assertSame($originalPassword, $admin->refresh()->getRawOriginal('password'));
        $this->assertSame('admin', $admin->username);
    }
}
