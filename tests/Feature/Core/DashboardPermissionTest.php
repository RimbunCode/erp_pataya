<?php

namespace Tests\Feature\Core;

use App\Models\Core\Dashboard;
use App\Models\DashboardWidget;
use App\Models\User\User;
use Database\Factories\Core\DashboardFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardPermissionTest extends TestCase {
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

        $this->user = User::factory()->create();

        $this->sessionData = [
            'permissions' => [
                Dashboard::class => [
                    0 => [
                        [
                            'model'        => Dashboard::class,
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

    private function reorderPayload(Dashboard $dashboard): array {
        $widgetIds = DashboardWidget::query()
            ->where('dashboard_id', $dashboard->id)
            ->pluck('id');

        return [
            'widgets' => $widgetIds->map(fn ($id) => ['id' => $id])->values()->toArray(),
        ];
    }

    public function test_reorder_widgets_is_not_blocked_by_permission_gate(): void {
        $dashboard = DashboardFactory::new()->create();
        DB::table('user_dashboards')->insert([
            'id'           => (string) Str::ulid(),
            'user_id'      => $this->user->id,
            'dashboard_id' => $dashboard->id,
            'order'        => 0,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        $response = $this->authenticatedRequest()
            ->post(route('dashboard.widgets.reorder', $dashboard), $this->reorderPayload($dashboard));

        $response->assertNoContent();
    }

    public function test_reorder_widgets_still_blocked_when_permission_missing(): void {
        $dashboard = DashboardFactory::new()->create();
        DB::table('user_dashboards')->insert([
            'id'           => (string) Str::ulid(),
            'user_id'      => $this->user->id,
            'dashboard_id' => $dashboard->id,
            'order'        => 0,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        $sessionWithoutWrite                                                                = $this->sessionData;
        $sessionWithoutWrite['permissions'][Dashboard::class][0][0]['permissions']['write'] = false;

        $response = $this
            ->withSession($sessionWithoutWrite)
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('dashboard.widgets.reorder', $dashboard), $this->reorderPayload($dashboard));

        $response->assertForbidden();
    }
}
