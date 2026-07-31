<?php

namespace Tests\Feature\Core;

use App\Models\Core\Currency;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Todo;
use App\Models\Helpdesk\Ticket;
use App\Models\User\User;
use App\Notifications\TodoAssignedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Baseline regresi (task 3.1 / spec todo-reminder-system) — menjamin jalur B
 * (sidebar addAssignee) dan C (buffered attachAssignees) tidak berubah
 * kontrak saat disatukan ke TodoService::createForReference() pada task 3.3-3.5.
 * Ditulis dan dijalankan terhadap kode LAMA (belum direfactor) sampai hijau,
 * lalu dijalankan ulang tanpa modifikasi setelah refactor (task 3.6).
 */
class TodoAssigneeEntryPointsContractTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        // is_example ditambahkan via seeder/initPermissions di prod, bukan migration.
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        FormatingSeries::create([
            'model'  => Todo::class,
            'name'   => 'ToDo',
            'format' => 'TODO/@[yy]-@[mm]/@[iiii]',
            'logs'   => ['imy' => []],
        ]);

        $this->user = User::factory()->create();
    }

    /**
     * addAssignee/updateTicket butuh permission 'read'/'write' pada model
     * target (lihat Controller::__construct keyPermission map). Currency dan
     * Ticket tidak ignorePermission seperti Todo, jadi butuh session
     * eksplisit — mengikuti pola
     * TodoTest::test_non_owner_with_explicit_permission_can_update_todo.
     */
    private function authenticatedRequest(): static {
        $fullPermission = [
            0 => [
                [
                    'level'        => 0,
                    'only_creator' => false,
                    'permissions'  => [
                        'read'   => true,
                        'write'  => true,
                        'delete' => true,
                    ],
                ],
            ],
        ];

        return $this
            ->withCookie('lang', 'en')
            ->withSession([
                'permissions' => [
                    Currency::class => $fullPermission,
                    Ticket::class   => $fullPermission,
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->actingAs($this->user);
    }

    // --- Jalur B: Controller::addAssignee (sidebar) ---
    // NB: Currency::$primaryKey adalah 'code' (bukan 'id') — referensikan
    // $currency->code sebagai reference_id, jangan pakai $currency->id (null).

    public function test_sidebar_assign_always_creates_open_todo(): void {
        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        $response = $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('todos', [
            'reference_id'      => $currency->code,
            'reference_type'    => Currency::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'status'            => 'open',
        ]);
    }

    /**
     * Requirement 7 (spec todo-reminder-system): allocated_to opsional
     * dengan fallback ke diri sendiri, berlaku di jalur B juga (bukan hanya
     * form standalone /todos).
     */
    public function test_sidebar_assign_without_allocated_to_defaults_to_self(): void {
        $currency = Currency::factory()->create();

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [])
            ->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $currency->code,
            'allocated_to_id'   => $this->user->id,
            'allocated_to_type' => 'user',
        ]);
    }

    public function test_sidebar_assign_defaults_priority_to_medium(): void {
        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id' => $currency->code,
            'priority'     => 'medium',
        ]);
    }

    public function test_sidebar_assign_sets_assigned_by_to_current_user(): void {
        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'   => $currency->code,
            'assigned_by_id' => $this->user->id,
        ]);
    }

    public function test_sidebar_assign_still_generates_code(): void {
        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        $todo = Todo::where('reference_id', $currency->code)->firstOrFail();
        $this->assertNotEmpty($todo->code);
    }

    public function test_sidebar_assign_still_notifies_assignee(): void {
        Notification::fake();

        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ]);

        Notification::assertSentTo($assignee, TodoAssignedNotification::class);
    }

    /**
     * Requirement 11 (spec todo-reminder-system): assignee sama pada
     * dokumen sama TIDAK lagi ditolak — event/meeting berulang butuh ini.
     * Constraint todos_reference_assignee_unique sudah dilonggarkan
     * (migrasi 2026_07_31_000003) dan guard already_assigned dihapus dari
     * TodoService::createForReference().
     */
    public function test_duplicate_assignment_allowed_on_sidebar_path(): void {
        $currency = Currency::factory()->create();
        $assignee = User::factory()->create();

        Todo::factory()->create([
            'reference_id'      => $currency->code,
            'reference_type'    => Currency::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
        ]);

        $this->authenticatedRequest()
            ->post(route('currencies.addAssignee', $currency), [
                'allocated_to' => ['id' => $assignee->id, 'type' => 'user'],
            ])
            ->assertSessionDoesntHaveErrors();

        $this->assertSame(2, Todo::where('reference_id', $currency->code)
            ->where('allocated_to_id', $assignee->id)
            ->count());
    }

    // --- Jalur C: BufferedAttachmentService::attachAssignees (Helpdesk ticket updateTicket) ---

    private function baseTicketPayload(Ticket $ticket): array {
        return [
            'type'       => $ticket->type,
            'priority'   => $ticket->priority,
            'subject'    => $ticket->subject,
            'assign_to'  => ['id' => $this->user->id, 'type' => 'user'],
            'status'     => 'in_progress',
            'progress'   => 10,
            'start_date' => now()->toDateString(),
        ];
    }

    public function test_buffered_assign_always_creates_open_todo(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'reference_type'    => Ticket::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'status'            => 'open',
        ]);
    }

    /**
     * Requirement 7 (spec todo-reminder-system): fallback ke diri sendiri
     * konsisten di jalur C juga. Item dengan 'type' (assignee-kind) terisi
     * tapi allocated_to_id kosong tetap diproses, bukan di-skip.
     */
    public function test_buffered_assign_without_allocated_to_id_defaults_to_self(): void {
        $ticket = Ticket::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['type' => 'user'],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'allocated_to_id'   => $this->user->id,
            'allocated_to_type' => 'user',
        ]);
    }

    public function test_buffered_assign_accepts_todo_type_without_colliding_with_assignee_kind(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    [
                        'allocated_to_id'    => $assignee->id,
                        'type'               => 'user',
                        'todo_type'          => 'deadline',
                        'reminder_lead_days' => [7, 3],
                    ],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
            'type'              => 'deadline',
        ]);
    }

    public function test_buffered_assign_defaults_todo_type_when_not_sent(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'    => $ticket->id,
            'allocated_to_id' => $assignee->id,
            'type'            => 'task',
        ]);
    }

    public function test_buffered_assign_ignores_smuggled_status(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    [
                        'allocated_to_id' => $assignee->id,
                        'type'            => 'user',
                        'status'          => 'closed',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'    => $ticket->id,
            'allocated_to_id' => $assignee->id,
            'status'          => 'open',
        ]);
    }

    public function test_buffered_assign_defaults_priority_to_medium(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id' => $ticket->id,
            'priority'     => 'medium',
        ]);
    }

    public function test_buffered_assign_sets_assigned_by_to_current_user(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        $this->assertDatabaseHas('todos', [
            'reference_id'   => $ticket->id,
            'assigned_by_id' => $this->user->id,
        ]);
    }

    public function test_buffered_assign_still_generates_code(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        $todo = Todo::where('reference_id', $ticket->id)->firstOrFail();
        $this->assertNotEmpty($todo->code);
    }

    public function test_buffered_assign_still_notifies_assignee(): void {
        Notification::fake();

        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ]);

        Notification::assertSentTo($assignee, TodoAssignedNotification::class);
    }

    /**
     * Requirement 11 (spec todo-reminder-system): assignee sama pada
     * dokumen sama TIDAK lagi ditolak — lihat catatan setara di
     * test_duplicate_assignment_allowed_on_sidebar_path.
     */
    public function test_duplicate_assignment_allowed_on_buffered_path(): void {
        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        Todo::factory()->create([
            'reference_id'      => $ticket->id,
            'reference_type'    => Ticket::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
        ]);

        $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                ...$this->baseTicketPayload($ticket),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user'],
                ],
            ])
            ->assertSessionDoesntHaveErrors();

        $this->assertSame(2, Todo::where('reference_id', $ticket->id)
            ->where('allocated_to_id', $assignee->id)
            ->count());
    }
}
