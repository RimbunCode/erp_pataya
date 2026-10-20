<?php

namespace Tests\Feature\Settings;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\CoreSetting;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\Finances\FinanceSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Services\Core\Setting\SettingsRegistry;
use Database\Seeders\DeskSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Spec module-settings-foundation Task 7.3 (Requirement 8, P-7).
 * Grup "Module Settings": 1 anggota -> datar, >1 -> submenu, 0 -> hilang,
 * dihitung per desk setelah filter izin; forRoute mengenali rute setting.
 */
class ModuleSettingMenuTest extends TestCase {
    use RefreshDatabase;

    private function grantSelect(User $user, string $model): void {
        $role = Role::create(['name' => 'role-' . uniqid()]);
        $user->roles()->attach($role->id);

        $permission = Permission::where('model', $model)->firstOrFail();

        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'model'         => $model,
            'module'        => $permission->module,
            'name'          => $permission->name,
            'level'         => 0,
            'only_creator'  => false,
            'permissions'   => [PermissionEnum::Select->value => true],
        ]);
    }

    /** @return array<string, mixed> */
    private function loadMenuItems(User $user): array {
        $initial = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $initial->getContent(), $matches);
        $page = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR);

        return $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeaders([
                'X-Inertia'                   => 'true',
                'X-Inertia-Version'           => $page['version'] ?? '',
                'X-Inertia-Partial-Component' => 'Dashboard/Dashboard',
                'X-Inertia-Partial-Data'      => 'deskList,menuItems',
            ])
            ->get(route('dashboard'))
            ->assertOk()
            ->json('props.menuItems');
    }

    private function makeDeskWithGroup(User $user, int $attachedChildren): Desk {
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $group = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'route_name'      => '_group.module-settings',
            'label'           => 'Module Settings',
            'model'           => null,
        ]);

        $models = [FinanceSetting::class, SalesSetting::class];
        foreach ($models as $index => $model) {
            $model::initPermissions();
            $child = MenuItem::factory()->create([
                'primary_desk_id' => $desk->id,
                'route_name'      => $index === 0 ? 'moduleSettings.finance.*' : 'moduleSettings.sales.*',
                'label'           => $index === 0 ? 'Finance Settings' : 'Sales Settings',
                'model'           => $model,
                'parent_id'       => $group->id,
            ]);
            if ($index < $attachedChildren) {
                $desk->menuItems()->attach($child->id, ['order' => $index]);
            }
        }

        return $desk;
    }

    public function test_two_group_members_render_as_one_submenu(): void {
        CoreSetting::initPermissions();

        $user = User::factory()->create();
        $this->makeDeskWithGroup($user, 2);
        $this->grantSelect($user, FinanceSetting::class);
        $this->grantSelect($user, SalesSetting::class);

        $menuItems = $this->loadMenuItems($user);
        $groups    = array_values(array_filter(
            $menuItems,
            fn (array $item): bool => ($item['title'] ?? null) === 'Module Settings' && is_array($item['items'] ?? null),
        ));

        $this->assertCount(1, $groups);
        $this->assertCount(2, $groups[0]['items']);
    }

    public function test_single_group_member_renders_flat(): void {
        $user = User::factory()->create();
        $this->makeDeskWithGroup($user, 1);
        $this->grantSelect($user, FinanceSetting::class);
        $this->grantSelect($user, SalesSetting::class);

        $menuItems = $this->loadMenuItems($user);
        $titles    = array_column($menuItems, 'title');

        $this->assertContains('Finance Settings', $titles);
        $this->assertNotContains('Module Settings', $titles);
    }

    public function test_permission_filter_can_reduce_submenu_to_flat_item(): void {
        $user = User::factory()->create();
        $this->makeDeskWithGroup($user, 2);
        $this->grantSelect($user, SalesSetting::class);

        $menuItems = $this->loadMenuItems($user);
        $titles    = array_column($menuItems, 'title');

        $this->assertContains('Sales Settings', $titles);
        $this->assertNotContains('Finance Settings', $titles);
        $this->assertNotContains('Module Settings', $titles);
    }

    public function test_group_disappears_without_any_select_permission(): void {
        $user = User::factory()->create();
        $this->makeDeskWithGroup($user, 2);

        $menuItems = $this->loadMenuItems($user);
        $titles    = array_column($menuItems, 'title');

        $this->assertNotContains('Module Settings', $titles);
        $this->assertNotContains('Finance Settings', $titles);
        $this->assertNotContains('Sales Settings', $titles);
    }

    public function test_for_route_resolves_setting_routes_to_registry_items(): void {
        $desk    = Desk::factory()->create();
        $finance = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'route_name'      => 'moduleSettings.finance.*',
            'model'           => FinanceSetting::class,
        ]);

        $this->assertSame($finance->id, MenuItem::forRoute('moduleSettings.finance.show')->id);
        $this->assertSame($finance->id, MenuItem::forRoute('moduleSettings.finance.update')->id);
    }

    public function test_desk_seeder_is_idempotent_and_registers_registry_pages(): void {
        (new DeskSeeder)->run();
        (new DeskSeeder)->run();

        $this->assertSame(1, MenuItem::where('route_name', '_group.module-settings')->count());

        foreach (SettingsRegistry::all() as $key => $page) {
            $items = MenuItem::where('route_name', "moduleSettings.{$key}.*")->get();
            $this->assertCount(1, $items, "Expected exactly one MenuItem for moduleSettings.{$key}.*");
            $this->assertSame($page['model'], $items->first()->model);
            $this->assertSame(
                collect($page['desks'])->map(fn ($domain): string => $domain->value)->sort()->values()->all(),
                $items->first()->desks()->pluck('domain')->map(fn ($domain): string => $domain->value)->sort()->values()->all(),
            );
        }

        $this->assertSame(
            CoreSetting::class,
            MenuItem::where('route_name', 'companies.*')->firstOrFail()->model,
        );
    }
}
