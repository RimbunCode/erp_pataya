<?php

namespace Tests\Feature\Settings;

use App\Events\Core\ModuleSettingUpdated;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Http\Middleware\ResolveActiveDesk;
use App\Models\Core\Branch;
use App\Models\Core\CoreSetting;
use App\Models\Core\Country;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Tax;
use App\Models\Sales\SalesSetting;
use App\Models\User\User;
use App\Services\Core\Setting\LegacyPreferenceMap;
use App\Services\Core\Setting\PreferenceMigrator;
use Database\Factories\Core\BranchFactory;
use Database\Factories\Core\CurrencyFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * P-8: spec module-settings-foundation Task 6.6.
 * Validasi otorisasi 403 tanpa read/write, validasi request, dan keselarasan Company.
 */
class ModuleSettingPermissionsTest extends TestCase {
    use RefreshDatabase;

    protected User $user;
    protected Branch $branch;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
            ResolveActiveDesk::class,
        ]);

        $this->withCookies(['lang' => 'en']);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->branch = BranchFactory::new()->create(['code' => 'HQ']);
        $this->user   = User::factory()->create();

        FinanceSetting::initPermissions();
        CoreSetting::initPermissions();
    }

    private function sessionWithPermission(string $modelClass, array $perms): array {
        return [
            'currentBranch' => $this->branch->id,
            'permissions'   => [
                $modelClass => [
                    0 => [
                        [
                            'model'        => $modelClass,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $perms,
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_init_permissions_does_not_change_setting_schema(): void {
        $before = Schema::getColumnListing('core_settings');

        CoreSetting::initPermissions();

        $this->assertSame($before, Schema::getColumnListing('core_settings'));
        $this->assertDatabaseHas('permissions', [
            'model' => CoreSetting::class,
        ]);
    }

    public function test_p8_user_without_read_permission_is_forbidden_on_show(): void {
        $response = $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, [
                'read'  => false,
                'write' => false,
            ]))
            ->get(route('moduleSettings.finance.show'));

        $response->assertForbidden();
    }

    public function test_p8_user_without_write_permission_is_forbidden_on_update(): void {
        $response = $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, [
                'read'  => true,
                'write' => false,
            ]))
            ->put(route('moduleSettings.finance.update'), [
                'tax_invoice_serial_range_start' => 10,
                'tax_invoice_serial_range_end'   => 50,
            ]);

        $response->assertForbidden();
    }

    public function test_p8_user_with_write_permission_can_update_module_setting(): void {
        $response = $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, [
                'read'  => true,
                'write' => true,
            ]))
            ->put(route('moduleSettings.finance.update'), [
                'tax_invoice_serial_range_start' => 500,
                'tax_invoice_serial_range_end'   => 999,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('finance_settings', [
            'tax_invoice_serial_range_start' => 500,
            'tax_invoice_serial_range_end'   => 999,
        ]);
    }

    public function test_read_only_setting_page_is_accessible_without_write_permission(): void {
        $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, ['read' => true, 'write' => false]))
            ->getJson(route('moduleSettings.finance.show'), ['X-Inertia' => 'true'])
            ->assertOk()->assertJsonPath('props.canWrite', false);
    }

    public function test_setting_page_exposes_true_write_permission_and_no_database_metadata(): void {
        $response = $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, ['read' => true, 'write' => true]))
            ->getJson(route('moduleSettings.finance.show'), ['X-Inertia' => 'true'])
            ->assertOk()->assertJsonPath('props.canWrite', true);

        $this->assertArrayNotHasKey('id', $response->json('props.setting'));
    }

    public function test_serial_counter_is_not_writable_via_module_request(): void {
        FinanceSetting::factory()->create(['tax_invoice_serial_last_used' => 20]);
        $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(FinanceSetting::class, ['write' => true]))
            ->putJson(route('moduleSettings.finance.update'), [
                'tax_invoice_serial_range_start' => 10,
                'tax_invoice_serial_range_end'   => 50,
                'tax_invoice_serial_last_used'   => 5,
            ])->assertUnprocessable()->assertJsonValidationErrors('tax_invoice_serial_last_used');
        $this->assertSame(20, FinanceSetting::current()->tax_invoice_serial_last_used);
    }

    public function test_missing_registry_entry_fails_closed_without_writing(): void {
        $route    = Route::getRoutes()->getByName('moduleSettings.finance.update');
        $defaults = $route->defaults;
        $route->defaults('moduleKey', 'missing');
        try {
            $this->actingAs($this->user)
                ->withSession($this->sessionWithPermission(FinanceSetting::class, ['write' => true]))
                ->putJson(route('moduleSettings.finance.update'), ['tax_invoice_serial_range_start' => 10])
                ->assertNotFound();
            $this->assertDatabaseMissing('finance_settings', ['tax_invoice_serial_range_start' => 10]);
        } finally {
            $route->defaults = $defaults;
        }
    }

    public function test_p8_company_controller_maintains_core_setting_and_main_branch(): void {
        CurrencyFactory::new()->create(['code' => 'IDR', 'symbol' => 'Rp']);

        $response = $this->actingAs($this->user)
            ->withSession($this->sessionWithPermission(CoreSetting::class, [
                'read'  => true,
                'write' => true,
            ]))
            ->put(route('companies.update'), [
                'company_name'        => 'PT Usaha Bersama',
                'city'                => 'Surabaya',
                'default_currency_id' => 'IDR',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('core_settings', [
            'company_name'        => 'PT Usaha Bersama',
            'city'                => 'Surabaya',
            'default_currency_id' => 'IDR',
        ]);

        $this->assertDatabaseHas('branches', [
            'name' => 'PT Usaha Bersama',
        ]);
    }

    public function test_company_rejects_read_and_write_without_model_permission(): void {
        $this->actingAs($this->user)->withSession(['permissions' => []]);

        $this->getJson(route('companies.index'))->assertForbidden();
        $this->putJson(route('companies.update'), ['company_name' => 'Forbidden'])->assertForbidden();
        $this->postJson(route('companies.image'), [])->assertForbidden();
        $this->deleteJson(route('companies.removeImage'))->assertForbidden();
    }

    public function test_company_read_only_user_can_view_but_cannot_write(): void {
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, [
            'select' => false,
            'read'   => true,
            'write'  => false,
        ]));

        $this->getJson(route('companies.index'), ['X-Inertia' => 'true'])->assertOk();
        $this->putJson(route('companies.update'), ['company_name' => 'Forbidden'])->assertForbidden();
    }

    public function test_company_payload_excludes_sensitive_legacy_values_and_database_metadata(): void {
        Preference::create(['key' => 'mail_review_secret', 'value' => 'synthetic-secret']);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['read' => true]));

        $company = $this->getJson(route('companies.index'), ['X-Inertia' => 'true'])
            ->assertOk()->json('props.company');

        foreach (['mail_review_secret', 'id', 'singleton', 'created_at', 'updated_at'] as $key) {
            $this->assertArrayNotHasKey($key, $company);
        }
    }

    public function test_company_rejects_unknown_keys_without_changing_either_store(): void {
        CoreSetting::factory()->create(['company_name' => 'Original']);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['write' => true]));

        $this->putJson(route('companies.update'), [
            'company_name'       => 'Changed',
            'mail_review_secret' => 'synthetic-secret',
        ])->assertUnprocessable()->assertJsonValidationErrors('mail_review_secret');

        $this->assertSame('Original', CoreSetting::current()->company_name);
        $this->assertDatabaseMissing('preferences', ['key' => 'mail_review_secret']);
    }

    public function test_company_update_uses_settings_only_and_preserves_unspecified_branch_fields(): void {
        CoreSetting::factory()->create(['company_name' => 'Original', 'city' => 'Surabaya']);
        $this->branch->update(['is_main_branch' => true, 'shipping_city' => 'Surabaya']);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['write' => true]));

        $this->putJson(route('companies.update'), ['company_name' => 'Changed'])->assertRedirect();

        $this->assertDatabaseHas('branches', ['id' => $this->branch->id, 'name' => 'Changed', 'shipping_city' => 'Surabaya']);
        $this->assertDatabaseMissing('preferences', ['key' => 'company_name']);
    }

    public function test_company_normalizes_country_and_currency_link_values_and_allows_clearing(): void {
        Country::factory()->create(['code' => 'ID']);
        CurrencyFactory::new()->create(['code' => 'IDR', 'symbol' => 'Rp']);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['write' => true]));

        $this->putJson(route('companies.update'), [
            'country_id'          => ['code' => 'id'],
            'default_currency_id' => ['code' => 'idr'],
        ])->assertRedirect();
        $this->assertSame('IDR', CoreSetting::current()->default_currency_id);
        $this->assertDatabaseHas('branches', ['is_main_branch' => true, 'shipping_country_id' => 'ID']);

        $this->putJson(route('companies.update'), [
            'country_id'          => ['code' => ''],
            'default_currency_id' => null,
        ])->assertRedirect();
        $this->assertNull(CoreSetting::current()->country_id);
        $this->assertNull(CoreSetting::current()->default_currency_id);
        $this->assertDatabaseHas('branches', ['is_main_branch' => true, 'shipping_country_id' => null]);
    }

    public function test_company_and_branch_updates_roll_back_together(): void {
        Event::fake([ModuleSettingUpdated::class]);
        CoreSetting::factory()->create(['company_name' => 'Original']);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['write' => true]));
        Branch::saving(function (): void {
            throw new RuntimeException('Synthetic branch failure');
        });
        $this->withoutExceptionHandling();

        try {
            $this->putJson(route('companies.update'), ['company_name' => 'Changed']);
            $this->fail('Expected branch write to fail.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Synthetic branch failure', $exception->getMessage());
            $this->assertSame('Original', CoreSetting::current()->company_name);
            Event::assertNotDispatched(ModuleSettingUpdated::class);
        } finally {
            Branch::flushEventListeners();
        }
    }

    public function test_company_logo_assignment_and_removal_use_settings_only(): void {
        $fileId = (string) Str::ulid();
        DB::table('files')->insert([
            'id'         => $fileId,
            'name'       => 'Company logo',
            'mime_type'  => 'image/png',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['write' => true]));

        $this->postJson(route('companies.image'), ['filesId' => [$fileId]])->assertRedirect();
        $this->assertSame($fileId, CoreSetting::current()->company_image_id);
        $this->assertDatabaseMissing('preferences', ['key' => 'company_image']);

        $this->deleteJson(route('companies.removeImage'))->assertRedirect();
        $this->assertNull(CoreSetting::current()->company_image_id);
    }

    public function test_sales_setting_returns_tax_link_and_accepts_validated_tax_id(): void {
        $tax = Tax::create(['name' => 'PPN', 'rate' => 11]);
        SalesSetting::factory()->create(['default_tax_id' => $tax->id]);
        SalesSetting::initPermissions();
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(SalesSetting::class, ['read' => true, 'write' => true]));

        $this->getJson(route('moduleSettings.sales.show'), ['X-Inertia' => 'true'])
            ->assertOk()->assertJsonPath('props.defaultTax.id', $tax->id);
        $this->putJson(route('moduleSettings.sales.update'), ['default_tax_id' => null])->assertRedirect();
        $this->assertNull(SalesSetting::current()->default_tax_id);
        $this->putJson(route('moduleSettings.sales.update'), ['default_tax_id' => 'invalid-tax'])
            ->assertUnprocessable()->assertJsonValidationErrors('default_tax_id');
    }

    public function test_company_mail_settings_migrate_and_password_remains_private(): void {
        Preference::create(['key' => 'mail_host', 'value' => 'smtp.example.test']);
        Preference::create(['key' => 'mail_password', 'value' => 'synthetic-password']);
        app(PreferenceMigrator::class)->run();
        $this->actingAs($this->user)->withSession($this->sessionWithPermission(CoreSetting::class, ['read' => true, 'write' => true]));

        $this->getJson(route('companies.index'), ['X-Inertia' => 'true'])
            ->assertOk()
            ->assertJsonPath('props.company.mail_host', 'smtp.example.test')
            ->assertJsonPath('props.company.mail_password', null);
        $this->assertSame('synthetic-password', CoreSetting::current()->mail_password);
        $this->assertNotSame('synthetic-password', DB::table('core_settings')->value('mail_password'));
        $this->assertArrayNotHasKey('mail_password', CoreSetting::current()->toArray());
        $this->assertArrayNotHasKey('mail_host', LegacyPreferenceMap::build());
        $this->assertArrayNotHasKey('mail_password', LegacyPreferenceMap::build());

        $this->putJson(route('companies.update'), ['mail_host' => 'new.smtp.test', 'mail_password' => ''])
            ->assertRedirect();
        $this->assertSame('synthetic-password', CoreSetting::current()->mail_password);
        $this->assertSame('new.smtp.test', CoreSetting::current()->mail_host);
        $this->putJson(route('companies.update'), ['mail_password' => 'replacement-password'])->assertRedirect();
        $this->assertSame('replacement-password', CoreSetting::current()->mail_password);
        $this->assertSame('synthetic-password', Preference::withoutGlobalScopes()->find('mail_password')->value);
    }
}
