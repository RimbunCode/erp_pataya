<?php

namespace Tests\Feature\Core;

use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Core\Log;
use App\Models\Core\Todo;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LogControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->user = User::factory()->create();
    }

    private function sessionWithLogPermission(array $permissions): array {
        return [
            'permissions' => [
                Log::class => [
                    0 => [
                        [
                            'model'        => Log::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $permissions,
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    public function test_index_returns_403_without_select_permission(): void {
        $response = $this
            ->withSession($this->sessionWithLogPermission(['select' => false, 'read' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.index'));

        $response->assertForbidden();
    }

    public function test_index_returns_200_with_select_permission(): void {
        $response = $this
            ->withSession($this->sessionWithLogPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.index'));

        $response->assertOk();
    }

    public function test_index_lists_logs_from_multiple_loggable_types_without_scoping(): void {
        $todoA     = Todo::factory()->create();
        $todoB     = Todo::factory()->create();
        $otherUser = User::factory()->create();

        $this->actingAs($this->user);
        $todoA->logForCreated();

        $this->actingAs($otherUser);
        $todoB->logForCreated();

        $response = $this
            ->withSession($this->sessionWithLogPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.index'));

        $response->assertOk();
        $this->assertDatabaseHas('logs', ['loggable_id' => $todoA->id, 'user_id' => $this->user->id]);
        $this->assertDatabaseHas('logs', ['loggable_id' => $todoB->id, 'user_id' => $otherUser->id]);
    }

    public function test_show_returns_403_without_read_permission(): void {
        $todo = Todo::factory()->create();
        $this->actingAs($this->user);
        $todo->logForCreated();
        $log = Log::where('loggable_id', $todo->id)->firstOrFail();

        $response = $this
            ->withSession($this->sessionWithLogPermission(['select' => false, 'read' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.show', $log));

        $response->assertForbidden();
    }

    public function test_show_returns_200_with_read_permission(): void {
        $todo = Todo::factory()->create();
        $this->actingAs($this->user);
        $todo->logForCreated();
        $log = Log::where('loggable_id', $todo->id)->firstOrFail();

        $response = $this
            ->withSession($this->sessionWithLogPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.show', $log));

        $response->assertOk();
    }

    public function test_no_mutating_routes_registered_for_logs(): void {
        $routes = collect(app('router')->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'logs'));

        $methods = $routes->flatMap(fn ($route) => $route->methods())->unique()->values()->all();

        $this->assertEqualsCanonicalizing(['GET', 'HEAD'], $methods);
    }

    public static function conditionalRuleLogs(): array {
        $cases = [];
        foreach ([DefaultTaxRule::class, DefaultWarehouseRule::class] as $model) {
            foreach (['created', 'updated', 'deleted'] as $action) {
                foreach ([false, true] as $removed) {
                    $cases[class_basename($model) . '-' . $action . ($removed ? '-removed' : '-existing')] = [$model, $action, $removed];
                }
            }
        }

        return $cases;
    }

    #[DataProvider('conditionalRuleLogs')]
    public function test_show_conditional_rule_log_preserves_snapshots(string $model, string $action, bool $removed): void {
        $rule   = $model::factory()->create();
        $before = $action === 'created' ? null : array_replace($rule->auditData(), ['priority' => 1]);
        $after  = $action === 'deleted' ? null : array_replace($rule->auditData(), ['priority' => 2]);
        $log    = Log::create([
            'user_id'       => $this->user->id,
            'loggable_type' => $model,
            'loggable_id'   => $rule->id,
            'action'        => $action,
            'activity'      => ['en' => 'Rule audit'],
            'data_before'   => $before,
            'data_after'    => $after,
        ]);

        if ($removed) {
            $rule->delete();
        }

        $this->withSession($this->sessionWithLogPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.show', $log))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Core/ShowLog')
                ->where('title', $log->code)
                ->where('formPathname', '')
                ->where('dataBefore', $before)
                ->where('dataAfter', $after)
                ->where('log.id', $log->id)
                ->where('breadcrumbs.0.name', 'core.log.title')
                ->where('breadcrumbs.0.link', route('logs.index')));
    }

    public function test_show_soft_deleted_record_log_preserves_snapshots(): void {
        $todo   = Todo::factory()->create();
        $before = ['description' => 'Before deletion'];
        $log    = Log::create([
            'user_id'       => $this->user->id,
            'loggable_type' => Todo::class,
            'loggable_id'   => $todo->id,
            'action'        => 'deleted',
            'activity'      => ['en' => 'Record deleted'],
            'data_before'   => $before,
            'data_after'    => null,
        ]);
        $todo->delete();
        $this->assertSoftDeleted($todo);

        $this->withSession($this->sessionWithLogPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('logs.show', $log))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Core/ShowLog')
                ->where('formPathname', '')
                ->where('dataBefore', $before)
                ->where('dataAfter', null)
                ->where('breadcrumbs.0.name', 'core.log.title')
                ->where('breadcrumbs.0.link', route('logs.index')));
    }
}
