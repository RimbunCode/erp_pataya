<?php

namespace Tests\Feature\Core;

use App\Models\User\Assignable;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AssignableViewTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // is_example ditambahkan via seeder/initPermissions di prod, bukan migration.
        // Tambahkan ke semua tabel agar global scope HasExampleData tidak error di SQLite.
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_view_combines_users_and_roles_with_correct_type(): void {
        $user = User::factory()->create(['name' => 'Combined User']);
        $role = Role::create(['name' => 'Combined Role']);

        $userRow = Assignable::find($user->id);
        $roleRow = Assignable::find($role->id);

        $this->assertSame('user', $userRow->type);
        $this->assertSame('Combined User', $userRow->name);
        $this->assertSame('role', $roleRow->type);
        $this->assertSame('Combined Role', $roleRow->name);
    }

    public function test_new_user_or_role_appears_without_manual_sync(): void {
        $before = Assignable::count();

        User::factory()->create();
        Role::create(['name' => 'Fresh Role']);

        $this->assertSame($before + 2, Assignable::count());
    }

    public function test_soft_deleted_user_and_role_do_not_appear(): void {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'Deletable Role']);

        $user->delete();
        $role->delete();

        $this->assertNull(Assignable::find($user->id));
        $this->assertNull(Assignable::find($role->id));
    }
}
