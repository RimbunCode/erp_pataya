<?php

namespace Tests\Feature\Helpdesk;

use App\Models\Helpdesk\Tiket;
use App\Models\Helpdesk\TiketResponse;
use App\Models\User\User;
use App\Services\Helpdesk\TiketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TiketTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        $this->user = User::factory()->create();

        // Build session data with the required permissions for the Tiket model.
        // The Controller reads session('permissions')[ModelClass][level] to authorize
        // each action. The `lang` middleware requires the 'lang' cookie, so we add
        // it via withCookie on every request instead.
        // The AppMiddleware overwrites session('permissions') unless
        // session('permissions_version') matches the DB-resolved version.
        // For a user with no roles the version resolves to '0|0|0|0'.
        $this->sessionData = [
            'permissions' => [
                Tiket::class => [
                    0 => [
                        [
                            'model'        => Tiket::class,
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
     * Build the mocked TiketService and bind it in the container.
     *
     * @return Mockery\MockInterface&TiketService
     */
    private function mockService(): Mockery\MockInterface {
        $mock = Mockery::mock(TiketService::class);
        $this->app->instance(TiketService::class, $mock);

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

    public function test_can_create_tiket(): void {
        $tiket = Tiket::factory()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('create')
            ->once()
            ->andReturn($tiket);

        $response = $this->authenticatedRequest()
            ->post(route('tikets.store'), [
                'type'     => 'bug_problem',
                'priority' => 'high',
                'subject'  => 'Something is broken',
                'content'  => '<p>Detailed description</p>',
                'status'   => 'new',
                'progress' => 0,
            ]);

        $response->assertRedirect(route('tikets.show', $tiket));
    }

    public function test_can_update_tiket(): void {
        $tiket = Tiket::factory()->create();

        $mock = $this->mockService();
        $mock->shouldReceive('update')
            ->once()
            ->andReturnUsing(function (Tiket $t, array $data) use ($tiket) {
                $tiket->update([
                    'status'   => $data['status'],
                    'progress' => $data['progress'],
                ]);

                return $tiket;
            });

        $response = $this->authenticatedRequest()
            ->put(route('tikets.update', $tiket), [
                'type'      => 'task',
                'priority'  => 'medium',
                'subject'   => 'Updated subject',
                'status'    => 'in_progress',
                'progress'  => 50,
                'assign_to' => null,
            ]);

        $response->assertRedirect();

        $tiket->refresh();
        $this->assertSame('in_progress', $tiket->status);
        $this->assertSame(50, (int) $tiket->progress);
    }

    public function test_mark_done_sets_status_progress_end_date(): void {
        $tiket = Tiket::factory()->create([
            'status'   => 'in_progress',
            'progress' => 50,
            'end_date' => null,
        ]);

        $mock = $this->mockService();
        $mock->shouldReceive('markDone')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $tiket->id)
            ->andReturnUsing(function (Tiket $t) {
                $t->update([
                    'status'   => 'done',
                    'progress' => 100,
                    'end_date' => now(),
                ]);

                TiketResponse::create([
                    'tiket_id'     => $t->id,
                    'user_id'      => $this->user->id,
                    'assign_to_id' => null,
                    'status'       => 'done',
                    'progress'     => 100,
                    'end_date'     => now(),
                ]);

                return $t;
            });

        $response = $this->authenticatedRequest()
            ->put(route('tikets.markDone', $tiket));

        $response->assertRedirect();

        $tiket->refresh();
        $this->assertSame('done', $tiket->status);
        $this->assertSame(100, (int) $tiket->progress);
        $this->assertNotNull($tiket->end_date);

        $this->assertDatabaseHas('tiket_responses', [
            'tiket_id' => $tiket->id,
            'status'   => 'done',
            'progress' => 100,
        ]);
    }

    public function test_update_tiket_creates_response_and_updates_tiket(): void {
        $tiket = Tiket::factory()->create([
            'status'   => 'new',
            'progress' => 0,
        ]);

        $mock = $this->mockService();
        $mock->shouldReceive('updateTiket')
            ->once()
            ->withArgs(fn ($arg) => $arg->id === $tiket->id)
            ->andReturnUsing(function (Tiket $t, array $data) {
                $assignToId = $data['assign_to']['id'] ?? null;

                $t->update([
                    'assign_to_id' => $assignToId,
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                ]);

                return TiketResponse::create([
                    'tiket_id'     => $t->id,
                    'user_id'      => $this->user->id,
                    'assign_to_id' => $assignToId,
                    'status'       => $data['status'],
                    'progress'     => $data['progress'],
                    'content'      => $data['content'] ?? null,
                    'end_date'     => $data['end_date'] ?? null,
                ]);
            });

        $response = $this->authenticatedRequest()
            ->put(route('tikets.updateTiket', $tiket), [
                'status'    => 'in_progress',
                'progress'  => 30,
                'content'   => '<p>Working on it.</p>',
                'assign_to' => null,
            ]);

        $response->assertRedirect();

        $tiket->refresh();
        $this->assertSame('in_progress', $tiket->status);
        $this->assertSame(30, (int) $tiket->progress);

        $this->assertDatabaseHas('tiket_responses', [
            'tiket_id' => $tiket->id,
            'status'   => 'in_progress',
            'progress' => 30,
        ]);
    }

    public function test_can_delete_tiket(): void {
        $tiket = Tiket::factory()->create();

        $response = $this->authenticatedRequest()
            ->delete(route('tikets.destroy', $tiket));

        $response->assertRedirect(route('tikets.index'));

        $this->assertSoftDeleted('tikets', ['id' => $tiket->id]);
    }
}
