<?php

namespace Tests\Feature\Http;

use App\Models\User\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
