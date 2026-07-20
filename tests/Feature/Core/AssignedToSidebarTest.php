<?php

namespace Tests\Feature\Core;

use App\Models\Core\FormatingSeries;
use App\Models\Core\Todo;
use App\Models\Helpdesk\Ticket;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\TodoAssignedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Tests\TestCase;

class AssignedToSidebarTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

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

        $this->sessionData = [
            'permissions' => [
                Ticket::class => [
                    0 => [
                        [
                            'model'        => Ticket::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_can_assign_user_to_any_document_via_sidebar(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $response = $this->authenticatedRequest()
            ->post(route('tickets.addAssignee', $ticket), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'reference_type'    => Ticket::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'status'            => 'open',
        ]);
    }

    public function test_can_assign_role_to_any_document_via_sidebar(): void {
        $ticket = Ticket::factory()->create();
        $role   = Role::create(['name' => 'Sidebar Role']);

        $response = $this->authenticatedRequest()
            ->post(route('tickets.addAssignee', $ticket), [
                'allocated_to' => ['id' => $role->id, 'type' => 'role'],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'reference_type'    => Ticket::class,
            'allocated_to_id'   => $role->id,
            'allocated_to_type' => 'role',
            'status'            => 'open',
        ]);
    }

    public function test_can_remove_assignee_via_sidebar(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();
        $todo     = Todo::factory()->create([
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $assignee->id,
        ]);

        $response = $this->authenticatedRequest()
            ->delete(route('tickets.removeAssignee', ['ticket' => $ticket, 'id' => $todo->id]));

        $response->assertRedirect();
        $this->assertSoftDeleted('todos', ['id' => $todo->id]);
    }

    public function test_cannot_remove_assignee_belonging_to_a_different_document(): void {
        $ticketA  = Ticket::factory()->create();
        $ticketB  = Ticket::factory()->create();
        $assignee = User::factory()->create();
        $todo     = Todo::factory()->create([
            'reference_id'    => $ticketB->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $assignee->id,
        ]);

        $response = $this->authenticatedRequest()
            ->delete(route('tickets.removeAssignee', ['ticket' => $ticketA, 'id' => $todo->id]));

        $response->assertNotFound();
        $this->assertDatabaseHas('todos', ['id' => $todo->id, 'deleted_at' => null]);
    }

    public function test_assigning_duplicate_active_user_is_rejected(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
        ]);
        $response = $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
        ]);

        $response->assertSessionHasErrors('allocated_to');
        $this->assertSame(1, Todo::where('reference_id', $ticket->id)
            ->where('reference_type', Ticket::class)
            ->where('allocated_to_id', $assignee->id)
            ->count());
    }

    public function test_assigning_duplicate_active_role_is_rejected(): void {
        $ticket = Ticket::factory()->create();
        $role   = Role::create(['name' => 'Duplicate Role']);

        $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $role->id, 'type' => 'role'],
        ]);
        $response = $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $role->id, 'type' => 'role'],
        ]);

        $response->assertSessionHasErrors('allocated_to');
        $this->assertSame(1, Todo::where('reference_id', $ticket->id)
            ->where('reference_type', Ticket::class)
            ->where('allocated_to_id', $role->id)
            ->count());
    }

    public function test_assigning_to_closed_assignee_is_still_rejected(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();
        Todo::factory()->create([
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $assignee->id,
            'status'          => 'closed',
        ]);

        $response = $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
        ]);

        $response->assertSessionHasErrors('allocated_to');
        $this->assertSame(1, Todo::where('reference_id', $ticket->id)
            ->where('reference_type', Ticket::class)
            ->where('allocated_to_id', $assignee->id)
            ->count());
    }

    public function test_assigning_to_previously_removed_assignee_creates_new_row(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();
        $removed  = Todo::factory()->create([
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $assignee->id,
        ]);
        $removed->delete();

        $response = $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
        ]);

        $response->assertRedirect();
        $this->assertSame(1, Todo::where('reference_id', $ticket->id)
            ->where('reference_type', Ticket::class)
            ->where('allocated_to_id', $assignee->id)
            ->whereNull('deleted_at')
            ->count());
    }

    public function test_assign_stores_date_and_due_date(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            'date'         => '2026-08-01',
            'due_date'     => '2026-08-05',
        ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $assignee->id,
            'date'            => '2026-08-01 00:00:00',
            'due_date'        => '2026-08-05 00:00:00',
        ]);
    }

    public function test_assign_rejects_due_date_before_date(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $response = $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            'date'         => '2026-08-05',
            'due_date'     => '2026-08-01',
        ]);

        $response->assertSessionHasErrors('due_date');
    }

    public function test_assign_dispatches_todo_assigned_notification(): void {
        Notification::fake();

        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
        ]);

        Notification::assertSentTo($assignee, TodoAssignedNotification::class);
    }

    public function test_assign_to_self_does_not_dispatch_notification(): void {
        Notification::fake();

        $ticket = Ticket::factory()->create();

        $this->authenticatedRequest()->post(route('tickets.addAssignee', $ticket), [
            'allocated_to' => ['id' => $this->user->id, 'type' => 'user'],
        ]);

        Notification::assertNothingSent();
    }

    public function test_show_detail_assignees_include_all_statuses_with_allocated_to_id(): void {
        $ticket         = Ticket::factory()->create();
        $openAssignee   = User::factory()->create();
        $closedAssignee = User::factory()->create();
        Todo::factory()->create([
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $openAssignee->id,
            'status'          => 'open',
        ]);
        Todo::factory()->create([
            'reference_id'    => $ticket->id,
            'reference_type'  => Ticket::class,
            'allocated_to_id' => $closedAssignee->id,
            'status'          => 'closed',
        ]);

        $this->actingAs($this->user);
        $ticket->showDetail();
        $assignees = Inertia::getShared('assignees')();

        $this->assertCount(2, $assignees);
        $statuses = $assignees->pluck('status')->all();
        $this->assertContains('open', $statuses);
        $this->assertContains('closed', $statuses);
        $allocatedToIds = $assignees->pluck('allocated_to_id')->all();
        $this->assertContains($openAssignee->id, $allocatedToIds);
        $this->assertContains($closedAssignee->id, $allocatedToIds);
    }
}
