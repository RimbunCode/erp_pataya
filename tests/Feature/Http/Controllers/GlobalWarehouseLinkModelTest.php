<?php

namespace Tests\Feature\Http\Controllers;

use App\Models\Core\Branch;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ScopedWarehouseLookupFixture extends Warehouse {
    protected $table = 'warehouses';
}

class GlobalWarehouseLinkModelTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Warehouse $warehouse;

    protected function setUp(): void {
        parent::setUp();
        $this->user      = User::factory()->create();
        $currentBranch   = Branch::query()->create(['name' => 'Lookup current branch']);
        $otherBranch     = Branch::query()->create(['name' => 'Lookup other branch']);
        $this->warehouse = Warehouse::query()->create([
            'branch_id' => $otherBranch->id,
            'name'      => 'Cross branch settings warehouse',
            'code'      => 'GLOBAL-LOOKUP-WH',
        ]);
        $this->actingAs($this->user)->withSession([
            'currentBranch' => $currentBranch->id,
            'permissions'   => [],
        ]);
    }

    #[DataProvider('lookupProvider')]
    public function test_global_lookup_requires_current_permission_and_explicit_opt_in(string $lookup): void {
        $this->withSession(['permissions' => $this->stalePermissions()]);
        $this->lookup($lookup)
            ->assertOk()
            ->assertJsonMissing(['id' => $this->warehouse->id]);

        $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->withSession(['permissions' => []]);
        $this->lookup($lookup, ['includeGlobalBranch' => false])
            ->assertOk()
            ->assertJsonMissing(['id' => $this->warehouse->id]);
        $this->lookup($lookup)
            ->assertOk()
            ->assertJsonFragment(['id' => $this->warehouse->id]);
    }

    #[DataProvider('lookupProvider')]
    public function test_sales_settings_write_permission_allows_global_lookup(string $lookup): void {
        $this->grantPermission(SalesSetting::class, ['write' => true]);
        $this->lookup($lookup)
            ->assertOk()
            ->assertJsonFragment(['id' => $this->warehouse->id]);
    }

    #[DataProvider('lookupProvider')]
    public function test_revoked_permission_is_denied_even_with_stale_session_grant(string $lookup): void {
        $permission = $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->withSession(['permissions' => $this->stalePermissions()]);
        $this->lookup($lookup)->assertOk()->assertJsonFragment(['id' => $this->warehouse->id]);

        $permission->update(['permissions' => ['read' => false, 'write' => false]]);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $permission->update(['permissions' => ['read' => true]]);
        $permission->delete();
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);
    }

    #[DataProvider('lookupProvider')]
    public function test_disabled_deleted_or_unassigned_roles_do_not_allow_global_lookup(string $lookup): void {
        $permission = $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $role       = $permission->role;
        $this->withSession(['permissions' => $this->stalePermissions()]);

        $role->update(['is_disabled' => true]);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $role->update(['is_disabled' => false]);
        $role->delete();
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $role->restore();
        $this->user->roles()->detach($role);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);
    }

    #[DataProvider('lookupProvider')]
    public function test_global_lookup_does_not_accept_other_permissions_or_models(string $lookup): void {
        $permission = $this->grantPermission(PurchaseSetting::class, ['select' => true, 'create' => true]);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $permission->update(['permissions' => ['read' => true], 'level' => 1]);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $permission->update(['level' => 0, 'model' => Warehouse::class]);
        $this->lookup($lookup)->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);

        $permission->update(['model' => PurchaseSetting::class]);
        $this->lookup($lookup, ['model' => ScopedWarehouseLookupFixture::class])
            ->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);
    }

    public function test_global_lookup_id_preserves_soft_deleted_history_without_listing_it(): void {
        $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->warehouse->delete();

        $this->lookup('dropdown')->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);
        $this->lookup('id')->assertOk()
            ->assertJsonPath('id', $this->warehouse->id)
            ->assertJsonPath('deleted_at', fn ($value): bool => $value !== null);
    }

    public function test_global_lookup_id_keeps_response_column_restrictions(): void {
        $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->warehouse->update(['user_id' => $this->user->id]);

        $this->lookup('id', ['with' => ['pic'], 'fields' => ['*']])
            ->assertOk()
            ->assertJsonPath('id', $this->warehouse->id)
            ->assertJsonMissingPath('pic.email')
            ->assertJsonMissingPath('pic.password');
    }

    public function test_global_lookup_rejects_unauthenticated_requests(): void {
        auth()->logout();
        $this->withSession(['permissions' => $this->stalePermissions()]);

        foreach (['dropdown', 'id', 'select-data'] as $lookup) {
            $this->lookup($lookup)->assertUnauthorized();
        }
    }

    public function test_select_data_does_not_allow_global_lookup_with_revoked_permission(): void {
        $permission = $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->withSession(['permissions' => $this->stalePermissions()]);
        $permission->delete();

        $this->lookup('select-data')->assertOk()->assertJsonMissing(['id' => $this->warehouse->id]);
    }

    public function test_select_data_can_include_a_global_warehouse_with_current_settings_permission(): void {
        $this->grantPermission(PurchaseSetting::class, ['read' => true]);
        $this->lookup('select-data')->assertOk()->assertJsonFragment(['id' => $this->warehouse->id]);
    }

    public static function lookupProvider(): array {
        return ['dropdown' => ['dropdown'], 'cached dropdown' => ['cache'], 'lookup by id' => ['id']];
    }

    /** @param array<string, mixed> $overrides */
    private function lookup(string $lookup, array $overrides = []): TestResponse {
        $payload = [
            'model'               => Warehouse::class,
            'includeGlobalBranch' => true,
        ];
        if ($lookup === 'id') {
            $payload['id'] = $this->warehouse->id;
        } elseif ($lookup === 'cache') {
            $payload['cacheMode'] = true;
        } else {
            $payload['search'] = $this->warehouse->code;
        }

        return $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route($lookup === 'select-data' ? 'model.selectData' : 'model'), array_replace($payload, $overrides));
    }

    /** @param array<string, bool> $actions */
    private function grantPermission(string $model, array $actions): RolePermission {
        $role = Role::query()->create(['name' => 'Global lookup ' . Str::ulid()]);
        $this->user->roles()->attach($role);
        $permission = Permission::query()->firstOrCreate(['model' => $model], [
            'module'      => 'Setting',
            'name'        => class_basename($model),
            'permissions' => ['read', 'write'],
        ]);

        return RolePermission::query()->create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'module'        => 'Setting',
            'name'          => class_basename($model),
            'model'         => $model,
            'permissions'   => $actions,
            'level'         => 0,
            'only_creator'  => false,
        ]);
    }

    private function stalePermissions(): array {
        return [PurchaseSetting::class => [
            0 => [['permissions' => ['read' => true], 'only_creator' => false]],
        ]];
    }
}
