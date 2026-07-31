<?php

namespace Tests\Feature\Core;

use App\Models\Core\FormatingSeries;
use App\Models\Core\Todo;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TodoTest extends TestCase {
    use RefreshDatabase;

    private User $user;

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

        // FormatingSeries ditambahkan via initPermissions() di prod, bukan migration.
        // Buat manual agar TodoService::generateCode() (FormatingSeries::generate) jalan di test.
        FormatingSeries::create([
            'model'  => Todo::class,
            'name'   => 'ToDo',
            'format' => 'TODO/@[yy]-@[mm]/@[iiii]',
            'logs'   => ['imy' => []],
        ]);

        $this->user = User::factory()->create();
    }

    private function authenticatedRequest(): static {
        return $this
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_can_create_todo(): void {
        $assignee = User::factory()->create();

        $response = $this->authenticatedRequest()
            ->post(route('todos.store'), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
                'type'         => 'task',
                'description'  => 'Follow up with supplier',
                'priority'     => 'high',
                'status'       => 'open',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'priority'          => 'high',
            'status'            => 'open',
        ]);
    }

    public function test_can_create_todo_assigned_to_role(): void {
        $role = Role::create(['name' => 'Warehouse Staff']);

        $response = $this->authenticatedRequest()
            ->post(route('todos.store'), [
                'allocated_to' => ['id' => $role->id, 'type' => 'role'],
                'type'         => 'task',
                'description'  => 'Restock shelves',
                'priority'     => 'medium',
                'status'       => 'open',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
        ]);
    }

    public function test_can_update_todo(): void {
        $todo = Todo::factory()->create([
            'status'          => 'open',
            'priority'        => 'low',
            'allocated_to_id' => $this->user->id,
        ]);

        $response = $this->authenticatedRequest()
            ->put(route('todos.update', $todo), [
                'allocated_to' => ['id' => $todo->allocated_to_id, 'type' => $todo->allocated_to_type],
                'type'         => 'task',
                'description'  => $todo->description,
                'priority'     => 'high',
                'status'       => 'closed',
            ]);

        $response->assertRedirect();

        $todo->refresh();
        $this->assertSame('closed', $todo->status);
        $this->assertSame('high', $todo->priority);
    }

    public function test_delete_todo(): void {
        $todo = Todo::factory()->create(['allocated_to_id' => $this->user->id]);

        $response = $this->authenticatedRequest()
            ->delete(route('todos.destroy', $todo));

        $response->assertRedirect(route('todos.index'));
        $this->assertSoftDeleted('todos', ['id' => $todo->id]);
    }

    public function test_owner_can_access_own_todo_without_any_permission(): void {
        $todo = Todo::factory()->create(['assigned_by_id' => $this->user->id]);

        $this->authenticatedRequest()
            ->get(route('todos.show', $todo))
            ->assertOk();
    }

    public function test_any_user_can_view_todo_regardless_of_ownership(): void {
        $todo = Todo::factory()->create();

        $this->authenticatedRequest()
            ->get(route('todos.show', $todo))
            ->assertOk();
    }

    public function test_non_owner_without_permission_gets_403_on_update_and_destroy(): void {
        $todo = Todo::factory()->create();

        $this->authenticatedRequest()->put(route('todos.update', $todo), [
            'allocated_to' => ['id' => $todo->allocated_to_id, 'type' => $todo->allocated_to_type],
            'type'         => 'task',
            'description'  => $todo->description,
            'priority'     => $todo->priority,
            'status'       => $todo->status,
        ])->assertForbidden();
        $this->authenticatedRequest()->delete(route('todos.destroy', $todo))->assertForbidden();
    }

    public function test_non_owner_with_explicit_permission_can_update_todo(): void {
        $todo = Todo::factory()->create();

        $sessionData = [
            'permissions' => [
                Todo::class => [
                    0 => [
                        [
                            'model'        => Todo::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'read'   => true,
                                'write'  => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];

        $this->authenticatedRequest()
            ->withSession($sessionData)
            ->put(route('todos.update', $todo), [
                'allocated_to' => ['id' => $todo->allocated_to_id, 'type' => $todo->allocated_to_type],
                'type'         => 'task',
                'description'  => $todo->description,
                'priority'     => 'high',
                'status'       => $todo->status,
            ])
            ->assertRedirect();
    }

    public function test_create_page_defaults_assignee_to_logged_in_user(): void {
        $response = $this->authenticatedRequest()
            ->get(route('todos.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('defaultData.allocated_to.id', $this->user->id)
            ->where('defaultData.allocated_to.type', 'user'));
    }

    public function test_allocated_to_name_still_resolves_after_soft_delete(): void {
        // Regresi: view `assignables` diubah agar todo lama tetap menampilkan
        // nama assignee walau user/role-nya sudah di-soft-delete.
        $assignee = User::factory()->create(['name' => 'Soon To Be Deleted']);
        $todo     = Todo::factory()->create(['allocated_to_id' => $assignee->id, 'allocated_to_type' => 'user']);

        $assignee->delete();
        $todo->refresh();

        $this->assertSame('Soon To Be Deleted', $todo->allocatedTo->name);
    }

    public function test_allocated_users_returns_empty_when_role_soft_deleted(): void {
        $role = Role::create(['name' => 'Disbanded Team']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        $todo = Todo::factory()->create(['allocated_to_id' => $role->id, 'allocated_to_type' => 'role']);

        $role->delete();
        $todo->refresh();

        $this->assertCount(0, $todo->allocatedUsers());
    }

    public function test_blanking_allocated_to_on_edit_without_confirmation_is_rejected(): void {
        // assigned_by_id = $this->user agar editor lolos authorizeOwnTodoOrPermission
        // (dia yang membuat ToDo, walau assignee-nya orang lain) — skenario realistis:
        // meng-assign ke orang lain lalu ingin mengambilnya balik.
        $otherAssignee = User::factory()->create();
        $todo          = Todo::factory()->create([
            'status'          => 'open',
            'priority'        => 'low',
            'allocated_to_id' => $otherAssignee->id,
            'assigned_by_id'  => $this->user->id,
        ]);

        $this->authenticatedRequest()
            ->put(route('todos.update', $todo), [
                'allocated_to' => null,
                'type'         => 'task',
                'description'  => $todo->description,
                'priority'     => $todo->priority,
                'status'       => $todo->status,
            ])
            ->assertSessionHasErrors('allocated_to');

        $todo->refresh();
        $this->assertSame($otherAssignee->id, $todo->allocated_to_id);
    }

    public function test_blanking_allocated_to_on_edit_with_confirmation_reassigns_to_editor(): void {
        $otherAssignee = User::factory()->create();
        $todo          = Todo::factory()->create([
            'status'          => 'open',
            'priority'        => 'low',
            'allocated_to_id' => $otherAssignee->id,
            'assigned_by_id'  => $this->user->id,
        ]);

        $this->authenticatedRequest()
            ->put(route('todos.update', $todo), [
                'allocated_to'     => null,
                'type'             => 'task',
                'description'      => $todo->description,
                'priority'         => $todo->priority,
                'status'           => $todo->status,
                'confirm_reassign' => true,
            ])
            ->assertRedirect();

        $todo->refresh();
        $this->assertSame($this->user->id, $todo->allocated_to_id);
        $this->assertSame('user', $todo->allocated_to_type);
    }

    public function test_blanking_allocated_to_when_already_own_todo_skips_confirmation(): void {
        $todo = Todo::factory()->create([
            'status'          => 'open',
            'priority'        => 'low',
            'allocated_to_id' => $this->user->id,
        ]);

        $this->authenticatedRequest()
            ->put(route('todos.update', $todo), [
                'allocated_to' => null,
                'type'         => 'task',
                'description'  => $todo->description,
                'priority'     => $todo->priority,
                'status'       => $todo->status,
            ])
            ->assertRedirect();

        $todo->refresh();
        $this->assertSame($this->user->id, $todo->allocated_to_id);
    }
}
