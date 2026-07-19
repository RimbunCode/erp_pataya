<?php

namespace Tests\Feature\Core;

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
        $todo = Todo::factory()->create(['status' => 'open', 'priority' => 'low']);

        $response = $this->authenticatedRequest()
            ->put(route('todos.update', $todo), [
                'allocated_to' => ['id' => $todo->allocated_to_id, 'type' => $todo->allocated_to_type],
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
        $todo = Todo::factory()->create();

        $response = $this->authenticatedRequest()
            ->delete(route('todos.destroy', $todo));

        $response->assertRedirect(route('todos.index'));
        $this->assertSoftDeleted('todos', ['id' => $todo->id]);
    }
}
