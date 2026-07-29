<?php

namespace Tests\Feature\Helpdesk;

use App\Models\Core\File as FileModel;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Tag;
use App\Models\Core\Todo;
use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use App\Models\User\User;
use App\Services\Helpdesk\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class TicketTest extends TestCase {
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
        if (! FormatingSeries::where('model', Todo::class)->exists()) {
            FormatingSeries::create([
                'model'  => Todo::class,
                'name'   => 'ToDo',
                'format' => 'TODO/@[yy]-@[mm]/@[iiii]',
                'logs'   => ['imy' => []],
            ]);
        }

        // Kolom nested-set TreeView + user_id/parent_id pada `files` ditambahkan
        // di prod via command init, bukan migration. Shim agar File::create jalan di SQLite.
        Schema::table('files', function ($t) {
            if (! Schema::hasColumn('files', 'user_id')) {
                $t->ulid('user_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'parent_id')) {
                $t->ulid('parent_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'lft')) {
                $t->unsignedBigInteger('lft')->nullable();
            }
            if (! Schema::hasColumn('files', 'rgt')) {
                $t->unsignedBigInteger('rgt')->nullable();
            }
            if (! Schema::hasColumn('files', 'depth')) {
                $t->unsignedBigInteger('depth')->nullable();
            }
        });

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
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                                'print'  => true,
                                'import' => true,
                                'export' => true,
                                'share'  => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    /**
     * Build the mocked TicketService and bind it in the container.
     *
     * @return Mockery\MockInterface&TicketService
     */
    private function mockService(): Mockery\MockInterface {
        $mock = Mockery::mock(TicketService::class);
        $this->app->instance(TicketService::class, $mock);

        return $mock;
    }

    /**
     * Make an authenticated request builder with the lang cookie and session.
     */
    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_can_create_ticket(): void {
        $ticket = Ticket::factory()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('create')
            ->once()
            ->andReturn($ticket);

        $response = $this->authenticatedRequest()
            ->post(route('tickets.store'), [
                'type'       => 'bug_problem',
                'priority'   => 'high',
                'subject'    => 'Something is broken',
                'status'     => 'new',
                'progress'   => 0,
                'assign_to'  => ['id' => $this->user->id],
                'start_date' => now()->toDateTimeString(),
            ]);

        $response->assertRedirect(route('tickets.show', $ticket));
    }

    public function test_can_update_ticket(): void {
        $ticket = Ticket::factory()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('update')
            ->once()
            ->andReturnUsing(function (Ticket $_t, array $data) use ($ticket) {
                $ticket->update([
                    'status'   => $data['status'],
                    'progress' => $data['progress'],
                ]);

                return $ticket;
            });

        $response = $this->authenticatedRequest()
            ->put(route('tickets.update', $ticket), [
                'type'       => 'task',
                'priority'   => 'medium',
                'subject'    => 'Updated subject',
                'status'     => 'in_progress',
                'progress'   => 50,
                'assign_to'  => ['id' => $this->user->id],
                'start_date' => now()->toDateTimeString(),
            ]);

        $response->assertRedirect();

        $ticket->refresh();
        $this->assertSame('in_progress', $ticket->status->value);
        $this->assertSame(50, (int) $ticket->progress);
    }

    public function test_mark_done_sets_status_progress_end_date(): void {
        $ticket = Ticket::factory()->create([
            'status'   => 'in_progress',
            'progress' => 50,
            'end_date' => null,
        ]);

        $mock = $this->mockService();
        $mock->shouldReceive('markDone')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $ticket->id)
            ->andReturnUsing(function (Ticket $t) {
                $t->update([
                    'status'   => 'done',
                    'progress' => 100,
                    'end_date' => now(),
                ]);

                TicketResponse::create([
                    'ticket_id'    => $t->id,
                    'user_id'      => $this->user->id,
                    'assign_to_id' => null,
                    'type'         => $t->type,
                    'priority'     => $t->priority,
                    'subject'      => $t->subject,
                    'status'       => 'done',
                    'progress'     => 100,
                    'end_date'     => now(),
                ]);

                return $t;
            });

        $response = $this->authenticatedRequest()
            ->put(route('tickets.markDone', $ticket));

        $response->assertRedirect();

        $ticket->refresh();
        $this->assertSame('done', $ticket->status->value);
        $this->assertSame(100, (int) $ticket->progress);
        $this->assertNotNull($ticket->end_date);

        $this->assertDatabaseHas('ticket_responses', [
            'ticket_id' => $ticket->id,
            'status'    => 'done',
            'progress'  => 100,
        ]);
    }

    public function test_update_ticket_creates_response_and_updates_ticket(): void {
        $ticket = Ticket::factory()->create([
            'status'   => 'new',
            'progress' => 0,
        ]);

        $mock = $this->mockService();
        $mock->shouldReceive('updateTicket')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $ticket->id)
            ->andReturnUsing(function (Ticket $model, array $data) {
                $assignToId = $data['assign_to']['id'] ?? null;

                $model->update([
                    'assign_to_id' => $assignToId,
                    'type'         => $data['type'],
                    'priority'     => $data['priority'],
                    'subject'      => $data['subject'],
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                    'start_date'   => $data['start_date'],
                    'due_date'     => $data['due_date'] ?? null,
                ]);

                return TicketResponse::create([
                    'ticket_id'    => $model->id,
                    'user_id'      => $this->user->id,
                    'assign_to_id' => $assignToId,
                    'type'         => $data['type'],
                    'priority'     => $data['priority'],
                    'subject'      => $data['subject'],
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                    'start_date'   => $data['start_date'],
                    'due_date'     => $data['due_date'] ?? null,
                    'content'      => $data['content'] ?? null,
                    'content_json' => $data['content_json'] ?? null,
                ]);
            });

        $response = $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                'type'       => 'bug_problem',
                'priority'   => 'high',
                'subject'    => 'Updated subject',
                'status'     => 'in_progress',
                'progress'   => 30,
                'content'    => '<p>Working on it.</p>',
                'assign_to'  => ['id' => $this->user->id],
                'start_date' => now()->toDateTimeString(),
            ]);

        $response->assertRedirect();

        $ticket->refresh();
        $this->assertSame('in_progress', $ticket->status->value);
        $this->assertSame(30, (int) $ticket->progress);

        $this->assertDatabaseHas('ticket_responses', [
            'ticket_id' => $ticket->id,
            'status'    => 'in_progress',
            'progress'  => 30,
        ]);
    }

    public function test_update_ticket_attaches_buffered_tags_to_ticket(): void {
        $ticket   = Ticket::factory()->create();
        $existing = Tag::create(['name' => 'urgent']);

        $response = $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                'type'          => 'bug_problem',
                'priority'      => 'high',
                'subject'       => 'Updated subject',
                'status'        => 'in_progress',
                'progress'      => 30,
                'assign_to'     => ['id' => $this->user->id],
                'start_date'    => now()->toDateTimeString(),
                'buffered_tags' => [
                    ['id' => $existing->id, 'name' => 'urgent'],
                    ['name' => 'baru-banget', 'isNew' => true],
                ],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('taggables', [
            'taggable_id'   => $ticket->id,
            'taggable_type' => Ticket::class,
            'tag_id'        => $existing->id,
        ]);
        $newTag = Tag::where('name', 'baru-banget')->firstOrFail();
        $this->assertDatabaseHas('taggables', [
            'taggable_id'   => $ticket->id,
            'taggable_type' => Ticket::class,
            'tag_id'        => $newTag->id,
        ]);
        $this->assertDatabaseMissing('taggables', [
            'taggable_type' => TicketResponse::class,
        ]);
    }

    public function test_update_ticket_attaches_buffered_assignees_as_todos(): void {
        Notification::fake();

        $ticket   = Ticket::factory()->create();
        $assignee = User::factory()->create();

        $response = $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                'type'               => 'bug_problem',
                'priority'           => 'high',
                'subject'            => 'Updated subject',
                'status'             => 'in_progress',
                'progress'           => 30,
                'assign_to'          => ['id' => $this->user->id],
                'start_date'         => now()->toDateTimeString(),
                'buffered_assignees' => [
                    ['allocated_to_id' => $assignee->id, 'type' => 'user', 'name' => $assignee->name],
                ],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('todos', [
            'reference_id'      => $ticket->id,
            'reference_type'    => Ticket::class,
            'allocated_to_id'   => $assignee->id,
            'allocated_to_type' => 'user',
        ]);
        $this->assertDatabaseMissing('todos', [
            'reference_type' => TicketResponse::class,
        ]);
    }

    public function test_update_ticket_attaches_uploaded_file_via_files_id(): void {
        $ticket = Ticket::factory()->create();
        $file   = FileModel::create([
            'name'      => 'doc',
            'path'      => 'files/doc.pdf',
            'extension' => 'pdf',
            'mime_type' => 'application/pdf',
            'is_public' => false,
            'is_draft'  => true,
            'user_id'   => $this->user->id,
        ]);

        $response = $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                'type'       => 'bug_problem',
                'priority'   => 'high',
                'subject'    => 'Updated subject',
                'status'     => 'in_progress',
                'progress'   => 30,
                'assign_to'  => ['id' => $this->user->id],
                'start_date' => now()->toDateTimeString(),
                'filesId'    => [$file->id],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $ticket->id,
            'fileable_type' => Ticket::class,
            'file_id'       => $file->id,
        ]);
        $this->assertDatabaseMissing('fileables', [
            'fileable_type' => TicketResponse::class,
        ]);
        $this->assertFalse($file->refresh()->is_draft);
    }

    public function test_index_redirects_to_show_when_code_param_given(): void {
        $ticket = Ticket::factory()->create(['code' => '26/0001']);

        $response = $this->authenticatedRequest()
            ->get(route('tickets.index', ['code' => '26/0001']));

        $response->assertRedirect(route('tickets.show', $ticket));
    }

    public function test_index_returns_404_when_code_not_found(): void {
        $response = $this->authenticatedRequest()
            ->get(route('tickets.index', ['code' => 'INVALID']));

        $response->assertStatus(404);
    }

    public function test_delete_ticket_is_forbidden(): void {
        $ticket = Ticket::factory()->create();

        $response = $this->authenticatedRequest()
            ->delete(route('tickets.destroy', $ticket));

        $response->assertSessionHasErrors('delete');
        $this->assertNotSoftDeleted('tickets', ['id' => $ticket->id]);
    }

    public function test_user_without_any_permission_can_still_crud_ticket(): void {
        $ticket = Ticket::factory()->create();

        $this->withSession(['permissions' => [], 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('tickets.show', $ticket))
            ->assertOk();
    }
}
