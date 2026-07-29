<?php

namespace Tests\Feature\Core;

use App\Models\Core\Preference;
use App\Models\Core\Todo;
use App\Models\Helpdesk\Ticket;
use App\Models\User\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PermissionInitIgnorePermissionTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_init_permissions_writes_ignore_permission_true_for_ticket_and_todo(): void {
        Ticket::initPermissions();
        Todo::initPermissions();

        $this->assertTrue(Permission::where('model', Ticket::class)->value('ignore_permission'));
        $this->assertTrue(Permission::where('model', Todo::class)->value('ignore_permission'));
    }

    public function test_init_permissions_defaults_ignore_permission_false_for_other_models(): void {
        Preference::initPermissions();

        $this->assertFalse((bool) Permission::where('model', Preference::class)->value('ignore_permission'));
    }
}
