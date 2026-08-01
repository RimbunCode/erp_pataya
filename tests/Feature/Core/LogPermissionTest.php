<?php

namespace Tests\Feature\Core;

use App\Models\Core\Log;
use App\Models\User\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LogPermissionTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasColumn('logs', 'have_transactions')) {
            Schema::table('logs', fn ($t) => $t->boolean('have_transactions')->default(false));
        }
    }

    public function test_log_permissions_only_exposes_select_and_read(): void {
        $reflection = new \ReflectionMethod(Log::class, 'permissions');
        $reflection->setAccessible(true);

        $this->assertSame(['select', 'read'], $reflection->invoke(null));
    }

    public function test_init_permissions_registers_only_select_and_read_for_log(): void {
        Log::initPermissions();

        $permission = Permission::where('model', Log::class)->first();

        $this->assertNotNull($permission);
        $this->assertEqualsCanonicalizing(['select', 'read'], (array) $permission->permissions);
        $this->assertFalse($permission->is_submitable);
    }
}
