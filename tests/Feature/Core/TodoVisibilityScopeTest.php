<?php

namespace Tests\Feature\Core;

use App\Models\Core\Todo;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TodoVisibilityScopeTest extends TestCase {
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

    private function requestAs(User $user, bool $withSelectPermission): static {
        $session = [
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];

        if ($withSelectPermission) {
            $session['permissions'] = [
                Todo::class => [
                    0 => [
                        [
                            'model'        => Todo::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true],
                        ],
                    ],
                ],
            ];
        }

        return $this
            ->withSession($session)
            ->withCookie('lang', 'en')
            ->actingAs($user);
    }

    private function todoIds($response): Collection {
        preg_match('/data-page="([^"]*)"/', $response->getContent(), $m);
        $page = json_decode(html_entity_decode($m[1] ?? '{}'), true);
        $rows = $page['props']['data']['data'] ?? [];

        return collect($rows)->pluck('id');
    }

    public function test_user_without_permission_only_sees_todos_assigned_directly_to_them(): void {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $mine   = Todo::factory()->create(['allocated_to_id' => $user->id, 'allocated_to_type' => 'user']);
        $theirs = Todo::factory()->create(['allocated_to_id' => $other->id, 'allocated_to_type' => 'user']);

        $response = $this->requestAs($user, withSelectPermission: false)->get(route('todos.index'));

        $response->assertOk();
        $ids = $this->todoIds($response);
        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($theirs->id));
    }

    public function test_user_without_permission_sees_todos_assigned_to_their_role(): void {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'Visible Role']);
        $user->roles()->attach($role->id);

        $viaRole       = Todo::factory()->create(['allocated_to_id' => $role->id, 'allocated_to_type' => 'role']);
        $unrelatedRole = Role::create(['name' => 'Unrelated Role']);
        $viaOtherRole  = Todo::factory()->create(['allocated_to_id' => $unrelatedRole->id, 'allocated_to_type' => 'role']);

        $response = $this->requestAs($user, withSelectPermission: false)->get(route('todos.index'));

        $response->assertOk();
        $ids = $this->todoIds($response);
        $this->assertTrue($ids->contains($viaRole->id));
        $this->assertFalse($ids->contains($viaOtherRole->id));
    }

    public function test_user_with_permission_sees_all_todos(): void {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $mine   = Todo::factory()->create(['allocated_to_id' => $user->id, 'allocated_to_type' => 'user']);
        $theirs = Todo::factory()->create(['allocated_to_id' => $other->id, 'allocated_to_type' => 'user']);

        $response = $this->requestAs($user, withSelectPermission: true)->get(route('todos.index'));

        $response->assertOk();
        $ids = $this->todoIds($response);
        $this->assertTrue($ids->contains($mine->id));
        $this->assertTrue($ids->contains($theirs->id));
    }

    public function test_visibility_scoping_does_not_return_403(): void {
        $user = User::factory()->create();
        Todo::factory()->create();

        $response = $this->requestAs($user, withSelectPermission: false)->get(route('todos.index'));

        $response->assertOk();
    }

    public function test_role_assigned_then_deleted_does_not_error(): void {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'To Be Deleted']);
        $user->roles()->attach($role->id);

        Todo::factory()->create(['allocated_to_id' => $role->id, 'allocated_to_type' => 'role']);
        $role->delete();

        $response = $this->requestAs($user, withSelectPermission: true)->get(route('todos.index'));

        $response->assertOk();
    }
}
