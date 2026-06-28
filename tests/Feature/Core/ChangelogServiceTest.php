<?php

namespace Tests\Feature\Core;

use App\Models\Core\ChangelogRead;
use App\Models\User\User;
use App\Services\Core\ChangelogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ChangelogServiceTest extends TestCase {
    use RefreshDatabase;

    private ChangelogService $service;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->service = new ChangelogService;
    }

    public function test_store_creates_changelog_with_html_links(): void {
        $raw = "## Bug Fixes\n- perbaiki login bug [#26/0001]\n- fix export [#26/0002]";

        $changelog = $this->service->store('v1.2.0', 'production', $raw);

        $this->assertDatabaseHas('changelogs', ['version' => 'v1.2.0', 'environment' => 'production']);
        $this->assertStringContainsString('href="/tickets?code=26/0001"', $changelog->content_html);
        $this->assertStringContainsString('href="/tickets?code=26/0002"', $changelog->content_html);
        $this->assertEquals($raw, $changelog->content_raw);
    }

    public function test_store_updates_existing_on_redeploy(): void {
        $this->service->store('v1.2.0', 'production', 'first deploy');
        $this->service->store('v1.2.0', 'production', 'second deploy');

        $this->assertDatabaseCount('changelogs', 1);
        $this->assertDatabaseHas('changelogs', ['version' => 'v1.2.0', 'content_raw' => 'second deploy']);
    }

    public function test_mark_all_read_marks_unread_changelogs(): void {
        $user = User::factory()->create();
        $this->service->store('v1.0.0', 'production', 'v1');
        $this->service->store('v1.1.0', 'production', 'v2');
        $this->service->store('v1.2.0', 'production', 'v3');

        $this->assertEquals(3, $this->service->getUnreadCount($user));

        $this->service->markAllRead($user);

        $this->assertEquals(0, $this->service->getUnreadCount($user));
        $this->assertDatabaseCount('changelog_reads', 3);
    }

    public function test_mark_all_read_is_idempotent(): void {
        $user = User::factory()->create();
        $this->service->store('v1.0.0', 'production', 'v1');

        $this->service->markAllRead($user);
        $this->service->markAllRead($user);

        $this->assertDatabaseCount('changelog_reads', 1);
    }

    public function test_store_strips_dangerous_html_in_raw_content(): void {
        $raw = "## Bug Fixes\n- fix XSS <script>alert(1)</script> [#26/0001]";

        $changelog = $this->service->store('v1.3.0', 'production', $raw);

        // html_input=strip menghapus tag berbahaya sepenuhnya (bukan escape)
        $this->assertStringNotContainsString('<script>', $changelog->content_html);
        $this->assertStringNotContainsString('&lt;script&gt;', $changelog->content_html);
        // Ticket link tetap dikonversi menjadi anchor Markdown → <a>
        $this->assertStringContainsString('href="/tickets?code=26/0001"', $changelog->content_html);
    }

    public function test_get_unread_count_excludes_read_by_user(): void {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $changelog = $this->service->store('v1.0.0', 'production', 'v1');
        $this->service->store('v1.1.0', 'production', 'v2');

        ChangelogRead::create(['changelog_id' => $changelog->id, 'user_id' => $user1->id, 'read_at' => now()]);

        $this->assertEquals(1, $this->service->getUnreadCount($user1));
        $this->assertEquals(2, $this->service->getUnreadCount($user2));
    }
}
