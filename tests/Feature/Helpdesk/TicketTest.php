<?php

namespace Tests\Feature\Helpdesk;

use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use App\Models\User\User;
use App\Services\Helpdesk\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TicketTest extends TestCase {
    use RefreshDatabase;
    private User $user;
    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        $this->user = User::factory()->create();

        // Build session data with the required permissions for the Ticket model.
        // The Controller reads session('permissions')[ModelClass][level] to authorize
        // each action. The `lang` middleware requires the 'lang' cookie, so we add
        // it via withCookie on every request instead.
        // The AppMiddleware overwrites session('permissions') unless
        // session('permissions_version') matches the DB-resolved version.
        // For a user with no roles the version resolves to '0|0|0|0'.
        $this->sessionData = [
            'permissions'         => [
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
                'type'     => 'bug_problem',
                'priority' => 'high',
                'subject'  => 'Something is broken',
                'content'  => '<p>Detailed description</p>',
                'status'   => 'new',
                'progress' => 0,
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
                'type'      => 'task',
                'priority'  => 'medium',
                'subject'   => 'Updated subject',
                'status'    => 'in_progress',
                'progress'  => 50,
                'assign_to' => null,
            ]);

        $response->assertRedirect();

        $ticket->refresh();
        $this->assertSame('in_progress', $ticket->status);
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
        $this->assertSame('done', $ticket->status);
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
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                ]);

                return TicketResponse::create([
                    'ticket_id'    => $model->id,
                    'user_id'      => $this->user->id,
                    'assign_to_id' => $assignToId,
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                    'content'      => $data['content'] ?? null,
                    'end_date'     => $data['end_date'] ?? null,
                ]);
            });

        $response = $this->authenticatedRequest()
            ->put(route('tickets.updateTicket', $ticket), [
                'status'    => 'in_progress',
                'progress'  => 30,
                'content'   => '<p>Working on it.</p>',
                'assign_to' => null,
            ]);

        $response->assertRedirect();

        $ticket->refresh();
        $this->assertSame('in_progress', $ticket->status);
        $this->assertSame(30, (int) $ticket->progress);

        $this->assertDatabaseHas('ticket_responses', [
            'ticket_id' => $ticket->id,
            'status'    => 'in_progress',
            'progress'  => 30,
        ]);
    }

    public function test_can_delete_ticket(): void {
        $ticket = Ticket::factory()->create();

        $response = $this->authenticatedRequest()
            ->delete(route('tickets.destroy', $ticket));

        $response->assertRedirect(route('tickets.index'));

        $this->assertSoftDeleted('tickets', ['id' => $ticket->id]);
    }
}
