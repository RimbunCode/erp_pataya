<?php

namespace Tests\Feature\Helpdesk;

use App\Models\Core\FormatingSeries;
use App\Models\Core\Log;
use App\Models\Core\Todo;
use App\Models\Helpdesk\Ticket;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TicketCommentSanitizationTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! FormatingSeries::where('model', Todo::class)->exists()) {
            FormatingSeries::create([
                'model'  => Todo::class,
                'name'   => 'ToDo',
                'format' => 'TODO/@[yy]-@[mm]/@[iiii]',
                'logs'   => ['imy' => []],
            ]);
        }

        if (! FormatingSeries::where('model', Ticket::class)->exists()) {
            FormatingSeries::create([
                'model'  => Ticket::class,
                'name'   => 'Ticket',
                'format' => '#@[yy]/@[iiii]',
                'logs'   => ['iy' => []],
            ]);
        }

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

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_add_comment_strips_script_tag(): void {
        $ticket = Ticket::factory()->create();

        $response = $this->authenticatedRequest()
            ->post(route('tickets.addComment', $ticket), [
                'comment' => '<p>Hello</p><script>alert(1)</script>',
            ]);

        $response->assertRedirect();

        $log = Log::where('loggable_id', $ticket->id)
            ->where('type', 'comment')
            ->firstOrFail();

        $this->assertStringNotContainsString('<script>', $log->activity);
        $this->assertStringContainsString('<p>Hello</p>', $log->activity);
    }

    public function test_add_comment_strips_event_handler_attribute(): void {
        $ticket = Ticket::factory()->create();

        $response = $this->authenticatedRequest()
            ->post(route('tickets.addComment', $ticket), [
                'comment' => '<img src="x" onerror="alert(1)">',
            ]);

        $response->assertRedirect();

        $log = Log::where('loggable_id', $ticket->id)
            ->where('type', 'comment')
            ->firstOrFail();

        $this->assertStringNotContainsString('onerror', $log->activity);
    }

    public function test_edit_comment_strips_script_tag(): void {
        $ticket = Ticket::factory()->create();

        $log = Log::create([
            'user_id'       => $this->user->id,
            'loggable_id'   => $ticket->id,
            'loggable_type' => Ticket::class,
            'type'          => 'comment',
            'activity'      => '<p>Original</p>',
        ]);

        $response = $this->authenticatedRequest()
            ->put(route('tickets.editComment', [$ticket, $log]), [
                'comment' => '<p>Edited</p><script>alert(2)</script>',
            ]);

        $response->assertRedirect();

        $this->assertStringNotContainsString('<script>', $log->refresh()->activity);
        $this->assertStringContainsString('<p>Edited</p>', $log->refresh()->activity);
    }
}
