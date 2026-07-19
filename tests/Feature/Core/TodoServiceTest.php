<?php

namespace Tests\Feature\Core;

use App\Models\Core\Todo;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\TodoAssignedNotification;
use App\Services\Core\TodoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TodoServiceTest extends TestCase {
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

    public function test_notify_assignee_skips_self_assignment(): void {
        Notification::fake();

        $user = User::factory()->create();
        $todo = Todo::factory()->create([
            'allocated_to_id' => $user->id,
            'assigned_by_id'  => $user->id,
        ]);

        app(TodoService::class)->notifyAssignee($todo);

        Notification::assertNothingSent();
    }

    public function test_notify_assignee_sends_to_different_user(): void {
        Notification::fake();

        $assigner = User::factory()->create();
        $assignee = User::factory()->create();
        $todo     = Todo::factory()->create([
            'allocated_to_id' => $assignee->id,
            'assigned_by_id'  => $assigner->id,
        ]);

        app(TodoService::class)->notifyAssignee($todo);

        Notification::assertSentTo($assignee, TodoAssignedNotification::class, function ($notification) {
            $channels = $notification->via($notification->todo->allocatedTo);

            return in_array('database', $channels, true)
                && in_array('broadcast', $channels, true)
                && in_array('mail', $channels, true);
        });
    }

    public function test_notify_assignee_fans_out_to_all_role_members(): void {
        Notification::fake();

        $assigner = User::factory()->create();
        $role     = Role::create(['name' => 'Fan-out Role']);
        $member1  = User::factory()->create();
        $member2  = User::factory()->create();
        $member1->roles()->attach($role->id);
        $member2->roles()->attach($role->id);

        $todo = Todo::factory()->create([
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
            'assigned_by_id'    => $assigner->id,
        ]);

        app(TodoService::class)->notifyAssignee($todo);

        Notification::assertSentTo($member1, TodoAssignedNotification::class);
        Notification::assertSentTo($member2, TodoAssignedNotification::class);
    }

    public function test_notify_assignee_to_role_skips_only_the_assigner_not_other_members(): void {
        Notification::fake();

        $role     = Role::create(['name' => 'Mixed Role']);
        $assigner = User::factory()->create();
        $other    = User::factory()->create();
        $assigner->roles()->attach($role->id);
        $other->roles()->attach($role->id);

        $todo = Todo::factory()->create([
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
            'assigned_by_id'    => $assigner->id,
        ]);

        app(TodoService::class)->notifyAssignee($todo);

        Notification::assertNotSentTo($assigner, TodoAssignedNotification::class);
        Notification::assertSentTo($other, TodoAssignedNotification::class);
    }
}
