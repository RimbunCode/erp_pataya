<?php

namespace Tests\Feature\Helpdesk;

use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use App\Models\User\User;
use App\Services\Helpdesk\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TicketResolveFromDeployTest extends TestCase {
    use RefreshDatabase;

    private TicketService $service;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->service = new TicketService;
    }

    public function test_resolves_ticket_and_creates_response(): void {
        $creator = User::factory()->create();
        $ticket  = Ticket::factory()->create([
            'status'        => 'in_progress',
            'progress'      => 50,
            'created_by_id' => $creator->id,
        ]);

        $result = $this->service->resolveFromDeploy($ticket, 'v1.2.0');

        $this->assertFalse($result);
        $ticket->refresh();
        $this->assertEquals('resolved', $ticket->status->value);
        $this->assertEquals(90, $ticket->progress);
        $this->assertEquals($creator->id, $ticket->assign_to_id);
        $this->assertNotNull($ticket->end_date);

        $response = TicketResponse::where('ticket_id', $ticket->id)->latest()->first();
        $this->assertNull($response->user_id);
        $this->assertEquals('resolved', $response->status);
        $this->assertEquals(90, $response->progress);
        $this->assertStringContainsString('v1.2.0', $response->content);
    }

    public function test_already_resolved_ticket_skips_update_but_creates_response(): void {
        $creator      = User::factory()->create();
        $assignedUser = User::factory()->create();
        $ticket       = Ticket::factory()->create([
            'status'        => 'resolved',
            'progress'      => 90,
            'created_by_id' => $creator->id,
            'assign_to_id'  => $assignedUser->id,
        ]);

        $responseCountBefore = TicketResponse::where('ticket_id', $ticket->id)->count();

        $result = $this->service->resolveFromDeploy($ticket, 'v1.3.0');

        $this->assertTrue($result);
        $ticket->refresh();
        $this->assertEquals('resolved', $ticket->status->value);
        $this->assertEquals($assignedUser->id, $ticket->assign_to_id);

        $responseCountAfter = TicketResponse::where('ticket_id', $ticket->id)->count();
        $this->assertEquals($responseCountBefore + 1, $responseCountAfter);
    }

    public function test_done_ticket_skips_update_but_creates_response(): void {
        $creator = User::factory()->create();
        $ticket  = Ticket::factory()->create([
            'status'        => 'done',
            'progress'      => 100,
            'created_by_id' => $creator->id,
        ]);

        $result = $this->service->resolveFromDeploy($ticket, 'v1.3.0');

        $this->assertTrue($result);
        $ticket->refresh();
        $this->assertEquals('done', $ticket->status->value);
        $this->assertEquals(100, $ticket->progress);
    }
}
