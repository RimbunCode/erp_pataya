<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Changelog;
use App\Models\User\User;
use App\Services\Core\ChangelogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ChangelogControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($t) => $t->boolean('is_example')->default(false));
        }

        $this->user = User::factory()->create();
    }

    public function test_index_accessible_by_authenticated_user(): void {
        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('changelogs.index'))
            ->assertOk();
    }

    public function test_index_marks_all_changelogs_as_read_on_visit(): void {
        $service = new ChangelogService;
        $service->store('v1.0.0', 'production', 'first release');
        $service->store('v1.1.0', 'production', 'second release');
        $service->store('v1.2.0', 'production', 'third release');

        $this->assertEquals(3, $service->getUnreadCount($this->user));

        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('changelogs.index'));

        $this->assertEquals(0, $service->getUnreadCount($this->user));
        $this->assertDatabaseCount('changelog_reads', 3);
    }

    public function test_unread_count_is_zero_for_user_who_visited(): void {
        $service = new ChangelogService;
        $service->store('v1.0.0', 'production', 'first release');

        $this->actingAs($this->user)
            ->withSession(['permissions' => []])
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => '1'])
            ->getJson(route('changelogs.index'));

        $count = Changelog::whereDoesntHave(
            'reads',
            fn ($q) => $q->where('user_id', $this->user->id),
        )->count();

        $this->assertEquals(0, $count);
    }
}
