<?php

namespace Tests\Feature\Core;

use App\Models\Core\Todo;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LogActionColumnTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->actingAs(User::factory()->create());
    }

    public function test_log_for_created_sets_action_created(): void {
        $todo = Todo::factory()->create();
        $todo->logForCreated();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $todo->id,
            'loggable_type' => Todo::class,
            'action'        => 'created',
        ]);
    }

    public function test_log_for_updated_sets_action_updated(): void {
        $todo = Todo::factory()->create();
        $todo->fillForUpdate(['description' => 'changed']);
        $todo->logForUpdated();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $todo->id,
            'loggable_type' => Todo::class,
            'action'        => 'updated',
        ]);
    }

    public function test_log_for_deleted_sets_action_deleted(): void {
        $todo = Todo::factory()->create();
        $todo->logForDeleted();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $todo->id,
            'loggable_type' => Todo::class,
            'action'        => 'deleted',
        ]);
    }

    public function test_log_for_restore_sets_action_restored(): void {
        $todo = Todo::factory()->create();
        $todo->logForRestore();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $todo->id,
            'loggable_type' => Todo::class,
            'action'        => 'restored',
        ]);
    }

    public function test_log_for_submitted_sets_action_submitted(): void {
        $item = Todo::factory()->create();
        $item->logForSubmitted();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $item->id,
            'loggable_type' => Todo::class,
            'action'        => 'submitted',
        ]);
    }

    public function test_log_for_cancelled_sets_action_cancelled(): void {
        $item = Todo::factory()->create();
        $item->logForCancelled();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $item->id,
            'loggable_type' => Todo::class,
            'action'        => 'cancelled',
        ]);
    }

    public function test_log_for_amended_sets_action_amended(): void {
        $item = Todo::factory()->create();
        $item->logForAmended();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $item->id,
            'loggable_type' => Todo::class,
            'action'        => 'amended',
        ]);
    }

    public function test_add_comment_does_not_set_action(): void {
        $todo = Todo::factory()->create();

        $response = $this->withCookie('lang', 'en')
            ->post(route('todos.addComment', $todo->id), [
                'comment'      => 'A comment without action',
                'comment_json' => null,
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('logs', [
            'loggable_id'   => $todo->id,
            'loggable_type' => Todo::class,
            'type'          => 'comment',
            'action'        => null,
        ]);
    }
}
