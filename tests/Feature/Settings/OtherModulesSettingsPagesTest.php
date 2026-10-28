<?php

namespace Tests\Feature\Settings;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetSetting;
use App\Models\Helpdesk\HelpdeskSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use Database\Seeders\ModuleSettingPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Spec module-settings-other-modules, Task 6 (Requirements 5.1, 5.4, 6.1, 6.2).
 */
class OtherModulesSettingsPagesTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        // Manifest Vite lokal bisa lebih tua dari halaman baru; test ini memeriksa props Inertia, bukan aset.
        $this->withoutVite();
        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        $this->user = User::factory()->create();
    }

    /** @param class-string $modelClass */
    private function sessionFor(string $modelClass, array $actions): array {
        return ['permissions' => [$modelClass => [0 => [['permissions' => $actions, 'only_creator' => false]]]]];
    }

    /** Sales memeriksa peran saat ini dari database, bukan hanya sesi. */
    private function grantSalesPermission(array $actions): void {
        $role = Role::query()->create(['name' => 'Other modules ' . Str::ulid()]);
        $this->user->roles()->attach($role);
        $permission = Permission::query()->firstOrCreate(['model' => SalesSetting::class], [
            'module'      => 'Setting',
            'name'        => 'SalesSetting',
            'permissions' => array_keys($actions),
        ]);
        RolePermission::query()->create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'module'        => 'Setting',
            'name'          => 'SalesSetting',
            'model'         => SalesSetting::class,
            'permissions'   => $actions,
            'level'         => 0,
            'only_creator'  => false,
        ]);
    }

    public function test_the_registry_exposes_the_asset_and_helpdesk_pages_on_their_desks(): void {
        $pages = config('settings.pages');

        $this->assertSame(AssetSetting::class, $pages['asset']['model']);
        $this->assertSame(HelpdeskSetting::class, $pages['helpdesk']['model']);
        $this->assertSame(['core', 'asset'], array_map(fn ($desk) => $desk->value, $pages['asset']['desks']));
        $this->assertSame(['core', 'helpdesk'], array_map(fn ($desk) => $desk->value, $pages['helpdesk']['desks']));
        $this->assertSame(route('moduleSettings.asset.show', absolute: false), '/settings/modules/asset');
        $this->assertSame(route('moduleSettings.helpdesk.show', absolute: false), '/settings/modules/helpdesk');
    }

    public function test_asset_settings_page_shows_the_stored_values(): void {
        AssetSetting::current()->fill(['default_depreciation_method' => 'straight_line', 'default_frequency_of_depreciation' => 6])->save();

        $this->actingAs($this->user)
            ->withSession($this->sessionFor(AssetSetting::class, ['read' => true, 'write' => true]))
            ->get(route('moduleSettings.asset.show'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Settings/Modules/AssetSettings')
                ->where('canWrite', true)
                ->where('setting.default_depreciation_method', 'straight_line')
                ->where('setting.default_frequency_of_depreciation', 6)
                ->where('setting.default_total_number_of_depreciations', null));
    }

    public function test_asset_settings_can_be_saved_and_cleared(): void {
        $session = $this->sessionFor(AssetSetting::class, ['read' => true, 'write' => true]);

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.asset.update'), [
                'default_depreciation_method'           => 'written_down_value',
                'default_frequency_of_depreciation'     => 12,
                'default_total_number_of_depreciations' => 4,
            ])
            ->assertSessionHasNoErrors();

        $stored = AssetSetting::query()->firstOrFail();
        $this->assertSame('written_down_value', $stored->default_depreciation_method);
        $this->assertSame(12, $stored->default_frequency_of_depreciation);
        $this->assertSame(4, $stored->default_total_number_of_depreciations);

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.asset.update'), [
                'default_depreciation_method'           => null,
                'default_frequency_of_depreciation'     => null,
                'default_total_number_of_depreciations' => null,
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($stored->fresh()->default_depreciation_method);
        $this->assertNull($stored->fresh()->default_frequency_of_depreciation);
    }

    public function test_asset_settings_reject_unknown_methods_and_non_positive_numbers(): void {
        $this->actingAs($this->user)
            ->withSession($this->sessionFor(AssetSetting::class, ['read' => true, 'write' => true]))
            ->put(route('moduleSettings.asset.update'), [
                'default_depreciation_method'           => 'sum_of_years',
                'default_frequency_of_depreciation'     => 0,
                'default_total_number_of_depreciations' => -3,
            ])
            ->assertSessionHasErrors([
                'default_depreciation_method',
                'default_frequency_of_depreciation',
                'default_total_number_of_depreciations',
            ]);

        $this->assertNull(AssetSetting::current()->default_depreciation_method);
    }

    public function test_asset_settings_are_forbidden_without_write_permission(): void {
        $this->actingAs($this->user)
            ->withSession($this->sessionFor(AssetSetting::class, ['read' => true, 'write' => false]))
            ->put(route('moduleSettings.asset.update'), ['default_depreciation_method' => 'manual'])
            ->assertForbidden();

        $this->actingAs($this->user)
            ->withSession($this->sessionFor(AssetSetting::class, ['read' => false, 'write' => false]))
            ->get(route('moduleSettings.asset.show'))
            ->assertForbidden();
    }

    public function test_helpdesk_settings_page_save_and_validation(): void {
        $session = $this->sessionFor(HelpdeskSetting::class, ['read' => true, 'write' => true]);

        $this->actingAs($this->user)->withSession($session)
            ->get(route('moduleSettings.helpdesk.show'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Settings/Modules/HelpdeskSettings')
                ->where('setting.default_type', null));

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.helpdesk.update'), [
                'default_type'     => 'question',
                'default_priority' => 'critical',
                'default_due_days' => 5,
            ])
            ->assertSessionHasNoErrors();

        $stored = HelpdeskSetting::query()->firstOrFail();
        $this->assertSame('question', $stored->default_type);
        $this->assertSame('critical', $stored->default_priority);
        $this->assertSame(5, $stored->default_due_days);

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.helpdesk.update'), [
                'default_type'     => 'incident',
                'default_priority' => 'urgent',
                'default_due_days' => -1,
            ])
            ->assertSessionHasErrors(['default_type', 'default_priority', 'default_due_days']);

        $this->assertSame('question', $stored->fresh()->default_type);
    }

    public function test_helpdesk_settings_are_forbidden_without_write_permission(): void {
        $this->actingAs($this->user)
            ->withSession($this->sessionFor(HelpdeskSetting::class, ['read' => true, 'write' => false]))
            ->put(route('moduleSettings.helpdesk.update'), ['default_type' => 'task'])
            ->assertForbidden();
    }

    public function test_quotation_validity_days_is_saved_from_the_sales_settings_page(): void {
        $this->grantSalesPermission(['read' => true, 'write' => true]);
        $session = $this->sessionFor(SalesSetting::class, ['read' => true, 'write' => true]);
        $payload = ['rate_change_action' => 'none', 'below_cost_action' => 'none'];

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.sales.update'), $payload + ['quotation_validity_days' => 30])
            ->assertSessionHasNoErrors();
        $this->assertSame(30, SalesSetting::query()->firstOrFail()->quotation_validity_days);

        $this->actingAs($this->user)->withSession($session)
            ->get(route('moduleSettings.sales.show'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('setting.quotation_validity_days', 30));

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.sales.update'), $payload + ['quotation_validity_days' => -5])
            ->assertSessionHasErrors('quotation_validity_days');
        $this->assertSame(30, SalesSetting::query()->firstOrFail()->quotation_validity_days);

        $this->actingAs($this->user)->withSession($session)
            ->put(route('moduleSettings.sales.update'), $payload + ['quotation_validity_days' => null])
            ->assertSessionHasNoErrors();
        $this->assertNull(SalesSetting::query()->firstOrFail()->quotation_validity_days);
    }

    public function test_the_permission_seeder_covers_the_new_setting_models(): void {
        $this->assertContains(AssetSetting::class, ModuleSettingPermissionSeeder::settingModels());
        $this->assertContains(HelpdeskSetting::class, ModuleSettingPermissionSeeder::settingModels());

        (new ModuleSettingPermissionSeeder)->run();

        $this->assertDatabaseHas('permissions', ['model' => AssetSetting::class, 'module' => 'Setting']);
        $this->assertDatabaseHas('permissions', ['model' => HelpdeskSetting::class, 'module' => 'Setting']);
    }
}
