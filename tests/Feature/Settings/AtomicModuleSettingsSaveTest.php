<?php

namespace Tests\Feature\Settings;

use App\Events\Core\AuditableModelSaved;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Finances\Tax;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AtomicModuleSettingsSaveTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);
    }

    public function putJson($uri, array $data = [], array $headers = [], $options = 0): TestResponse {
        if (preg_match('#/settings/modules/(purchase|sales)$#', parse_url($uri, PHP_URL_PATH) ?: '', $matches)
            && (array_key_exists('tax_rules', $data) || array_key_exists('warehouse_rules', $data))) {
            $data['rules_version'] ??= app(ModuleDefaultRulesService::class)->version($matches[1]);
        }

        return parent::putJson($uri, $data, $headers, $options);
    }

    #[DataProvider('moduleProvider')]
    public function test_one_request_saves_setting_and_both_rule_collections(string $module, string $modelClass): void {
        [$setting, $payload] = $this->prepareSave($module, $modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('warn', $setting->fresh()->rate_change_action);
        $this->assertSame(5.0, $setting->fresh()->over_billing_tolerance_percent);
        $this->assertDatabaseHas('default_tax_rules', ['id' => $payload['tax_rules'][0]['id'], 'priority' => 10]);
        $this->assertDatabaseHas('default_warehouse_rules', ['id' => $payload['warehouse_rules'][0]['id'], 'priority' => 20]);
        $this->assertDatabaseHas('logs', ['loggable_type' => $modelClass, 'loggable_id' => $setting->id, 'action' => 'updated']);
        $this->assertDatabaseHas('logs', ['loggable_type' => DefaultTaxRule::class, 'loggable_id' => $payload['tax_rules'][0]['id'], 'action' => 'updated']);
        $this->assertDatabaseHas('logs', ['loggable_type' => DefaultWarehouseRule::class, 'loggable_id' => $payload['warehouse_rules'][0]['id'], 'action' => 'updated']);
    }

    #[DataProvider('moduleProvider')]
    public function test_stale_combined_setting_save_returns_conflict_without_mutation(string $module, string $modelClass): void {
        [$setting, $payload]           = $this->prepareSave($module, $modelClass);
        $payload['rate_change_action'] = 'stop';
        $newRule                       = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null, 'item_type' => 'asset']);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)->assertStatus(409);

        $this->assertSame('none', $setting->fresh()->rate_change_action);
        $this->assertDatabaseHas('default_tax_rules', ['id' => $newRule->id, 'module' => $module]);
    }

    #[DataProvider('moduleProvider')]
    public function test_setting_only_save_does_not_replace_a_stale_rule_collection(string $module, string $modelClass): void {
        [, $payload] = $this->prepareSave($module, $modelClass);
        $newRule     = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null, 'item_type' => 'asset']);

        $this->putJson(route("moduleSettings.{$module}.update"), [
            'rate_change_action' => 'warn',
            'below_cost_action'  => 'none',
        ])->assertRedirect();

        $this->assertDatabaseHas('default_tax_rules', ['id' => $newRule->id, 'module' => $module]);
        $this->assertDatabaseHas('default_tax_rules', ['id' => $payload['tax_rules'][0]['id'], 'module' => $module]);
    }

    #[DataProvider('moduleProvider')]
    public function test_invalid_setting_reference_does_not_persist_either_part(string $module, string $modelClass): void {
        [, $payload] = $this->prepareSave($module, $modelClass);
        $deletedTax  = Tax::query()->create(['name' => 'Deleted default tax', 'rate' => 11]);
        $deletedTax->delete();
        $payload['default_tax_id'] = $deletedTax->id;
        $before                    = $this->snapshot($modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('default_tax_id');

        $this->assertSame($before, $this->snapshot($modelClass));
    }

    #[DataProvider('moduleProvider')]
    public function test_invalid_rule_reference_does_not_persist_either_part(string $module, string $modelClass): void {
        [, $payload]                                   = $this->prepareSave($module, $modelClass);
        $payload['warehouse_rules'][0]['warehouse_id'] = (string) Str::ulid();
        $before                                        = $this->snapshot($modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('warehouse_rules.0.warehouse_id');

        $this->assertSame($before, $this->snapshot($modelClass));
    }

    #[DataProvider('moduleProvider')]
    public function test_late_rule_validation_failure_rolls_back_setting_rules_and_audit(string $module, string $modelClass): void {
        [, $payload]                  = $this->prepareSave($module, $modelClass);
        $payload['warehouse_rules'][] = [
            ...$payload['warehouse_rules'][0],
            'id'        => (string) Str::ulid(),
            'item_type' => 'service',
        ];
        $before = $this->snapshot($modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('warehouse_rules.1.id');

        $this->assertSame($before, $this->snapshot($modelClass));
        $this->assertSame('none', app(SettingsService::class)->get($modelClass)->rate_change_action);
    }

    #[DataProvider('saveFailureProvider')]
    public function test_save_exception_rolls_back_setting_rules_and_audit(string $module, string $modelClass, string $failingClass): void {
        [, $payload] = $this->prepareSave($module, $modelClass);
        $before      = $this->snapshot($modelClass);
        Event::listen(AuditableModelSaved::class, static function (AuditableModelSaved $event) use ($failingClass): void {
            if ($event->model instanceof $failingClass && $event->action === 'updated') {
                throw new \RuntimeException('Simulated save failure.');
            }
        });

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)->assertServerError();

        $this->assertSame($before, $this->snapshot($modelClass));
        $this->assertSame('none', app(SettingsService::class)->get($modelClass)->rate_change_action);
    }

    #[DataProvider('moduleProvider')]
    public function test_legacy_setting_only_request_preserves_existing_rules(string $module, string $modelClass): void {
        [$setting, $payload] = $this->prepareSave($module, $modelClass);
        $rulesBefore         = $this->snapshot($modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), array_diff_key($payload, ['tax_rules' => true, 'warehouse_rules' => true]))
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('warn', $setting->fresh()->rate_change_action);
        $after = $this->snapshot($modelClass);
        $this->assertSame($rulesBefore['default_tax_rules'], $after['default_tax_rules']);
        $this->assertSame($rulesBefore['default_warehouse_rules'], $after['default_warehouse_rules']);
    }

    #[DataProvider('moduleProvider')]
    public function test_both_rule_collections_are_required_when_sending_combined_save(string $module, string $modelClass): void {
        [, $payload] = $this->prepareSave($module, $modelClass);
        unset($payload['warehouse_rules']);
        $before = $this->snapshot($modelClass);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('warehouse_rules');

        $this->assertSame($before, $this->snapshot($modelClass));
    }

    #[DataProvider('moduleProvider')]
    public function test_empty_rule_arrays_clear_both_collections_with_setting_update(string $module, string $modelClass): void {
        [$setting, $payload]        = $this->prepareSave($module, $modelClass);
        $payload['tax_rules']       = [];
        $payload['warehouse_rules'] = [];

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('warn', $setting->fresh()->rate_change_action);
        $this->assertDatabaseMissing('default_tax_rules', ['module' => $module]);
        $this->assertDatabaseMissing('default_warehouse_rules', ['module' => $module]);
    }

    #[DataProvider('moduleProvider')]
    public function test_read_only_actor_cannot_save_setting_or_rules(string $module, string $modelClass): void {
        [, $payload] = $this->prepareSave($module, $modelClass, ['read' => true]);
        $before      = $this->snapshot($modelClass);

        $this->withSession(['permissions' => [$modelClass => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]]])
            ->putJson(route("moduleSettings.{$module}.update"), $payload)->assertForbidden();

        $this->assertSame($before, $this->snapshot($modelClass));
    }

    public static function moduleProvider(): array {
        return ['purchase' => ['purchase', PurchaseSetting::class], 'sales' => ['sales', SalesSetting::class]];
    }

    public static function saveFailureProvider(): array {
        return [
            'purchase setting save' => ['purchase', PurchaseSetting::class, PurchaseSetting::class],
            'purchase rule save'    => ['purchase', PurchaseSetting::class, DefaultWarehouseRule::class],
            'sales setting save'    => ['sales', SalesSetting::class, SalesSetting::class],
            'sales rule save'       => ['sales', SalesSetting::class, DefaultWarehouseRule::class],
        ];
    }

    private function prepareSave(string $module, string $modelClass, array $actions = ['write' => true]): array {
        $setting       = $modelClass::current();
        $taxRule       = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null]);
        $warehouseRule = DefaultWarehouseRule::factory()->create(['module' => $module, 'document_type' => null]);
        $user          = User::factory()->create();
        $this->grantCurrentPermission($user, $modelClass, $actions);
        $this->actingAs($user)->withSession([
            'permissions' => [$modelClass => [0 => [['permissions' => $actions, 'only_creator' => false]]]],
        ]);

        return [$setting, [
            'rules_version'                  => app(ModuleDefaultRulesService::class)->version($module),
            'rate_change_action'             => 'warn',
            'below_cost_action'              => 'none',
            'over_billing_tolerance_percent' => 5,
            'tax_rules'                      => [[...array_diff_key($taxRule->auditData(), ['module' => true]), 'priority' => 10]],
            'warehouse_rules'                => [[...array_diff_key($warehouseRule->auditData(), ['module' => true]), 'priority' => 20]],
        ]];
    }

    /** @param array<string, bool> $actions */
    private function grantCurrentPermission(User $user, string $model, array $actions): void {
        $role = Role::query()->create(['name' => 'Atomic settings ' . Str::ulid()]);
        $user->roles()->attach($role);
        $permission = Permission::query()->firstOrCreate(['model' => $model], [
            'module'      => 'Setting',
            'name'        => class_basename($model),
            'permissions' => array_keys($actions),
        ]);

        RolePermission::query()->create([
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

    private function snapshot(string $modelClass): array {
        $settingTable = (new $modelClass)->getTable();

        return collect([$settingTable, 'default_tax_rules', 'default_warehouse_rules', 'logs'])
            ->mapWithKeys(fn (string $table): array => [$table => DB::table($table)->orderBy('id')->get()->map(fn (object $record): array => (array) $record)->all()])
            ->all();
    }
}
