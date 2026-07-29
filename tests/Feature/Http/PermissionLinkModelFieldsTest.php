<?php

namespace Tests\Feature\Http;

use App\Models\User\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Regresi: FormNewRule.jsx melempar `Cannot read properties of undefined (reading 'map')`
 * karena kolom `permissions`/`is_submitable`/`allow_only_creator` pada Permission tak
 * ter-mark `linkable`, sehingga selalu terpotong dari payload lookup `model` meski diminta
 * lewat `fields`. Test ini memastikan kolom tsb kini ikut dikembalikan.
 */
class PermissionLinkModelFieldsTest extends TestCase {
    use RefreshDatabase;

    public function test_lookup_returns_permissions_and_submitable_flags_when_requested(): void {
        $this->withoutMiddleware();

        $permission = Permission::create([
            'module'             => 'inventory',
            'name'               => 'items',
            'model'              => 'App\\Models\\Core\\Currency',
            'permissions'        => ['read', 'write', 'create'],
            'is_submitable'      => true,
            'allow_only_creator' => true,
        ]);

        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model'  => Permission::class,
                'fields' => ['model', 'permissions', 'is_submitable', 'allow_only_creator'],
            ]);

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $permission->id);

        $this->assertNotNull($row);
        $this->assertSame(['read', 'write', 'create'], $row['permissions']);
        $this->assertTrue($row['is_submitable']);
        $this->assertTrue($row['allow_only_creator']);
    }

    public function test_lookup_without_filter_includes_models_with_ignore_permission_true(): void {
        $this->withoutMiddleware();

        // getTranslateKeyAttribute() menginstansiasi model target (Ticket) — is_example
        // ditambahkan via initPermissions()/seeder di prod, bukan migration.
        if (! Schema::hasColumn('tickets', 'is_example')) {
            Schema::table('tickets', fn ($t) => $t->boolean('is_example')->default(false));
        }

        $ignored = Permission::create([
            'module'            => 'helpdesk',
            'name'              => 'tickets',
            'model'             => 'App\\Models\\Helpdesk\\Ticket',
            'ignore_permission' => true,
        ]);

        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model'  => Permission::class,
                'fields' => ['model'],
            ]);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');

        // Default: model ignore_permission=true (mis. Todo) TETAP muncul, karena
        // masih butuh diatur permission eksplisit-nya (row-level check non-owner).
        $this->assertTrue($ids->contains($ignored->id));
    }

    public function test_form_new_rule_filter_excludes_ticket_and_changelog_but_keeps_todo(): void {
        $this->withoutMiddleware();

        if (! Schema::hasColumn('tickets', 'is_example')) {
            Schema::table('tickets', fn ($t) => $t->boolean('is_example')->default(false));
        }
        if (! Schema::hasColumn('todos', 'is_example')) {
            Schema::table('todos', fn ($t) => $t->boolean('is_example')->default(false));
        }

        $ticket = Permission::create([
            'module'            => 'helpdesk',
            'name'              => 'tickets',
            'model'             => 'App\\Models\\Helpdesk\\Ticket',
            'ignore_permission' => true,
        ]);

        $changelog = Permission::create([
            'module'            => 'core',
            'name'              => 'changelogs',
            'model'             => 'App\\Models\\Core\\Changelog',
            'ignore_permission' => true,
        ]);

        $todo = Permission::create([
            'module'            => 'core',
            'name'              => 'todos',
            'model'             => 'App\\Models\\Core\\Todo',
            'ignore_permission' => true,
        ]);

        // Filter persis yang dikirim FormNewRule.jsx — notIn by model FQCN, bukan
        // by kolom ignore_permission (Todo tetap ignore_permission=true tapi TIDAK
        // boleh ikut ter-exclude, karena masih butuh diatur permission eksplisit
        // untuk akses non-owner lewat authorizeOwnTodoOrPermission()).
        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model'   => Permission::class,
                'fields'  => ['model'],
                'filters' => [
                    'model' => [
                        'notIn' => [
                            'App\\Models\\Helpdesk\\Ticket',
                            'App\\Models\\Core\\Changelog',
                        ],
                    ],
                ],
            ]);

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');

        $this->assertFalse($ids->contains($ticket->id));
        $this->assertFalse($ids->contains($changelog->id));
        $this->assertTrue($ids->contains($todo->id));
    }
}
