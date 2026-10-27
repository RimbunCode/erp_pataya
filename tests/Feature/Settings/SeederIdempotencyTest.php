<?php

namespace Tests\Feature\Settings;

use App\Models\Core\CoreSetting;
use App\Models\Core\Country;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Services\Core\Setting\SettingsService;
use Database\Factories\Core\CurrencyFactory;
use Database\Seeders\ModuleSettingPermissionSeeder;
use Database\Seeders\PreferenceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Skrip deploy menjalankan `db:seed --force` di setiap rilis, jadi seeder
 * setting dan izin tidak boleh menimpa perubahan yang dibuat admin.
 */
class SeederIdempotencyTest extends TestCase {
    use RefreshDatabase;

    public function test_preference_seeder_does_not_overwrite_existing_settings(): void {
        app(PreferenceSeeder::class)->run();

        CoreSetting::query()->firstOrFail()->forceFill(['company_name' => 'PT Edit Admin'])->saveQuietly();
        FinanceSetting::query()->firstOrFail()->forceFill([
            'tax_invoice_serial_range_start' => 100,
            'tax_invoice_serial_range_end'   => 200,
            'tax_invoice_serial_last_used'   => 150,
        ])->saveQuietly();

        app(PreferenceSeeder::class)->run();

        $this->assertSame('PT Edit Admin', CoreSetting::query()->firstOrFail()->company_name);
        $finance = FinanceSetting::query()->firstOrFail();
        $this->assertSame(100, (int) $finance->tax_invoice_serial_range_start);
        $this->assertSame(200, (int) $finance->tax_invoice_serial_range_end);
        $this->assertSame(150, (int) $finance->tax_invoice_serial_last_used);
        $this->assertSame(1, CoreSetting::query()->count());
        $this->assertSame(1, FinanceSetting::query()->count());
    }

    public function test_seeder_fills_country_and_currency_later_only_for_untouched_setting(): void {
        app(PreferenceSeeder::class)->run();
        $this->assertNull(CoreSetting::query()->firstOrFail()->country_id);

        Country::factory()->create(['code' => 'ID']);
        CurrencyFactory::new()->create(['code' => 'IDR', 'symbol' => 'Rp']);
        app(PreferenceSeeder::class)->run();

        $core = CoreSetting::query()->firstOrFail();
        $this->assertSame('ID', $core->country_id);
        $this->assertSame('IDR', $core->default_currency_id);

        // Admin mengosongkan negara lewat halaman setting: tidak boleh diisi ulang.
        $this->travel(5)->minutes();
        app(SettingsService::class)->update(CoreSetting::class, ['country_id' => null]);
        app(PreferenceSeeder::class)->run();

        $this->assertNull(CoreSetting::query()->firstOrFail()->country_id);
    }

    public function test_revoked_preference_permission_is_not_copied_to_core_setting(): void {
        Preference::initPermissions();
        $role                 = Role::create(['name' => 'Dicabut']);
        $preferencePermission = Permission::where('model', Preference::class)->firstOrFail();

        $source = RolePermission::create([
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
        $source->delete();

        app(ModuleSettingPermissionSeeder::class)->run();

        $this->assertSame(0, RolePermission::withTrashed()
            ->where('role_id', $role->id)
            ->where('model', CoreSetting::class)
            ->count());
    }

    public function test_rerunning_permission_seeder_keeps_admin_edits_and_revocations(): void {
        Preference::initPermissions();
        $role                 = Role::create(['name' => 'Dikelola Admin']);
        $systemManager        = Role::create(['name' => 'System Manager']);
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

        // Admin mengurangi izin CoreSetting peran kustom dan mencabut izin
        // Finance milik System Manager lewat halaman Roles.
        $copied = RolePermission::where('role_id', $role->id)->where('model', CoreSetting::class)->firstOrFail();
        $copied->update(['permissions' => ['select' => true, 'read' => true, 'write' => false]]);
        RolePermission::where('role_id', $systemManager->id)->where('model', FinanceSetting::class)->firstOrFail()->delete();

        app(ModuleSettingPermissionSeeder::class)->run();

        $this->assertSame(
            ['select' => true, 'read' => true, 'write' => false],
            RolePermission::where('role_id', $role->id)->where('model', CoreSetting::class)->firstOrFail()->permissions,
        );
        $this->assertNull(RolePermission::where('role_id', $systemManager->id)->where('model', FinanceSetting::class)->first());
        $this->assertSame(1, RolePermission::withTrashed()
            ->where('role_id', $systemManager->id)
            ->where('model', FinanceSetting::class)
            ->count());
    }
}
