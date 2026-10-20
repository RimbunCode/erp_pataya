<?php

namespace Tests\Feature\Settings;

use App\Models\Core\CoreSetting;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Services\Migration\Migrators\User\Roles\RolePermissionMigrator;
use Database\Seeders\ModuleSettingPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Spec module-settings-foundation Task 7.1 (Requirement 9).
 * Migrasi data izin Preference -> CoreSetting, grant System Manager,
 * dan pemetaan kunci legacy di RolePermissionMigrator.
 */
class ModuleSettingPermissionMigrationTest extends TestCase {
    use RefreshDatabase;

    public function test_permission_rows_exist_for_all_setting_models(): void {
        app(ModuleSettingPermissionSeeder::class)->run();

        foreach ([CoreSetting::class, FinanceSetting::class, SalesSetting::class] as $modelClass) {
            $this->assertDatabaseHas('permissions', ['model' => $modelClass]);
        }
    }

    public function test_finance_and_sales_use_dedicated_permission_module(): void {
        app(ModuleSettingPermissionSeeder::class)->run();

        $this->assertSame('Core', Permission::where('model', CoreSetting::class)->value('module'));
        $this->assertSame('Setting', Permission::where('model', FinanceSetting::class)->value('module'));
        $this->assertSame('Setting', Permission::where('model', SalesSetting::class)->value('module'));
    }

    public function test_preference_role_permissions_are_copied_to_core_setting_idempotently(): void {
        Preference::initPermissions();
        $role                 = Role::create(['name' => 'Custom Settings Keeper']);
        $preferencePermission = Permission::where('model', Preference::class)->firstOrFail();

        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $preferencePermission->id,
            'module'        => $preferencePermission->module,
            'name'          => $preferencePermission->name,
            'model'         => Preference::class,
            'level'         => 0,
            'only_creator'  => false,
            'is_submitable' => false,
            'permissions'   => ['select' => true, 'read' => true, 'write' => true],
        ]);

        app(ModuleSettingPermissionSeeder::class)->run();
        app(ModuleSettingPermissionSeeder::class)->run();

        $copied = RolePermission::where('role_id', $role->id)
            ->where('model', CoreSetting::class)
            ->get();

        $this->assertCount(1, $copied);
        $this->assertSame(
            ['select' => true, 'read' => true, 'write' => true],
            $copied->first()->permissions,
        );

        // Halaman setting modul baru tetap tertutup bagi peran non-admin (Req 9.4).
        $this->assertSame(0, RolePermission::where('role_id', $role->id)
            ->whereIn('model', [FinanceSetting::class, SalesSetting::class])
            ->count());
    }

    public function test_system_manager_gets_full_flags_on_all_setting_models(): void {
        app(ModuleSettingPermissionSeeder::class)->run();
        app(ModuleSettingPermissionSeeder::class)->run();

        $role = Role::create(['name' => 'System Manager']);

        app(ModuleSettingPermissionSeeder::class)->run();

        foreach ([CoreSetting::class, FinanceSetting::class, SalesSetting::class] as $modelClass) {
            $row = RolePermission::where('role_id', $role->id)->where('model', $modelClass)->first();
            $this->assertNotNull($row, "System Manager missing grant for {$modelClass}");
            $this->assertSame(
                ['select' => true, 'read' => true, 'write' => true],
                $row->permissions,
            );
        }

        $this->assertSame(
            3,
            RolePermission::where('role_id', $role->id)
                ->whereIn('model', [CoreSetting::class, FinanceSetting::class, SalesSetting::class])
                ->count(),
        );
    }

    public function test_legacy_setting_keys_map_to_core_setting(): void {
        $migrator = new RolePermissionMigrator;
        $property = new \ReflectionProperty(RolePermissionMigrator::class, 'permissionModelMap');
        $map      = $property->getValue($migrator);

        foreach (['manage_general_setting', 'manage_company_setting', 'manage_preference', 'manage_setting'] as $legacyKey) {
            $this->assertSame([CoreSetting::class], $map[$legacyKey] ?? null, "Legacy key {$legacyKey} must map to CoreSetting");
        }
    }
}
