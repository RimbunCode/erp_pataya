<?php

namespace Tests\Feature\Api;

use App\Models\Core\Changelog;
use App\Models\Helpdesk\Ticket;
use App\Models\Helpdesk\TicketResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeployWebhookTest extends TestCase {
    use RefreshDatabase;

    private const TOKEN = 'test-webhook-token-123';
    private const URL   = '/api/webhooks/deploy';

    private array $payload = [
        'tickets'     => [],
        'environment' => 'production',
        'version'     => 'v1.2.0',
        'changelog'   => "## Bug Fixes\n- fix login bug [#26/0001]",
    ];

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        config(['services.deploy.webhook_token' => self::TOKEN]);
    }

    private function authHeader(): array {
        return ['Authorization' => 'Bearer ' . self::TOKEN];
    }

    public function test_rejects_request_without_token(): void {
        $response = $this->postJson(self::URL, $this->payload);

        $response->assertStatus(401);
    }

    public function test_rejects_request_with_wrong_token(): void {
        $response = $this->postJson(self::URL, $this->payload, ['Authorization' => 'Bearer wrong-token']);

        $response->assertStatus(401);
    }

    public function test_valid_request_resolves_tickets(): void {
        $ticket  = Ticket::factory()->create(['code' => '26/0001', 'status' => 'in_progress']);
        $payload = array_merge($this->payload, ['tickets' => ['26/0001']]);

        $response = $this->postJson(self::URL, $payload, $this->authHeader());

        $response->assertStatus(200)
            ->assertJsonPath('resolved', ['26/0001'])
            ->assertJsonPath('not_found', [])
            ->assertJsonPath('already_resolved', []);

        $this->assertEquals('resolved', $ticket->fresh()->status->value);
        $this->assertEquals(90, $ticket->fresh()->progress);
    }

    public function test_not_found_ticket_code_added_to_not_found(): void {
        $payload = array_merge($this->payload, ['tickets' => ['99/9999']]);

        $response = $this->postJson(self::URL, $payload, $this->authHeader());

        $response->assertStatus(200)
            ->assertJsonPath('not_found', ['99/9999'])
            ->assertJsonPath('resolved', []);
    }

    public function test_already_resolved_ticket_added_to_already_resolved(): void {
        $ticket          = Ticket::factory()->create(['code' => '26/0001', 'status' => 'resolved']);
        $responsesBefore = TicketResponse::where('ticket_id', $ticket->id)->count();

        $payload  = array_merge($this->payload, ['tickets' => ['26/0001']]);
        $response = $this->postJson(self::URL, $payload, $this->authHeader());

        $response->assertStatus(200)
            ->assertJsonPath('already_resolved', ['26/0001'])
            ->assertJsonPath('resolved', []);

        $this->assertEquals($responsesBefore + 1, TicketResponse::where('ticket_id', $ticket->id)->count());
    }

    public function test_empty_tickets_still_saves_changelog(): void {
        $response = $this->postJson(self::URL, $this->payload, $this->authHeader());

        $response->assertStatus(200);
        $this->assertDatabaseHas('changelogs', ['version' => 'v1.2.0']);
        $this->assertNotNull($response->json('changelog_id'));
    }

    public function test_redeploy_same_version_updates_changelog(): void {
        $this->postJson(self::URL, $this->payload, $this->authHeader());
        $this->postJson(self::URL, array_merge($this->payload, ['changelog' => 'updated']), $this->authHeader());

        $this->assertDatabaseCount('changelogs', 1);
        $this->assertDatabaseHas('changelogs', ['version' => 'v1.2.0', 'content_raw' => 'updated']);
    }

    public function test_changelog_has_html_links(): void {
        $response = $this->postJson(self::URL, $this->payload, $this->authHeader());

        $response->assertStatus(200);

        $changelog = Changelog::find($response->json('changelog_id'));
        $this->assertStringContainsString('<a href="/tickets?code=26/0001">', $changelog->content_html);
    }
}
