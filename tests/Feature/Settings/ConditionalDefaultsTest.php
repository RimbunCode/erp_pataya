<?php

namespace Tests\Feature\Settings;

use App\Enums\DefaultsDocumentType;
use App\Events\Core\AuditableModelSaved;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Core\DefaultRules\DefaultTaxRule;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Item;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Services\Core\Setting\DocumentDefaultsResolver;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ConditionalDefaultsTest extends TestCase {
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
        $this->attachCurrentRulesVersion($uri, $data);

        return parent::putJson($uri, $data, $headers, $options);
    }

    public function put($uri, array $data = [], array $headers = []): TestResponse {
        $this->attachCurrentRulesVersion($uri, $data);

        return parent::put($uri, $data, $headers);
    }

    private function attachCurrentRulesVersion(string $uri, array &$data): void {
        if (! array_key_exists('tax_rules', $data) && ! str_contains($uri, '/default-rules')) {
            return;
        }

        if (preg_match('#/settings/modules/(purchase|sales)(?:/default-rules)?$#', parse_url($uri, PHP_URL_PATH) ?: '', $matches)) {
            $data['rules_version'] ??= app(ModuleDefaultRulesService::class)->version($matches[1]);
        }
    }

    public function test_resolver_applies_specific_rules_and_fallbacks_and_ignores_non_stock_warehouses(): void {
        $tax         = Tax::query()->create(['name' => 'Goods tax', 'rate' => 11]);
        $warehouse   = $this->createWarehouse('Default warehouse');
        $category    = Category::query()->create(['name' => 'Parts', 'type' => 'inventory']);
        $stockItem   = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true, 'category_id' => $category->id]);
        $serviceItem = Item::factory()->create(['type' => 'service', 'is_stock_item' => false, 'category_id' => null]);

        PurchaseSetting::current()->fill(['default_tax_id' => $tax->id, 'default_target_warehouse_id' => $warehouse->id])->save();
        DefaultTaxRule::query()->create([
            'module'        => 'purchase', 'document_type' => 'purchase_order', 'item_type' => 'goods',
            'is_stock_item' => true, 'item_category_id' => $category->id, 'tax_id' => null, 'priority' => 0,
        ]);
        DefaultWarehouseRule::query()->create([
            'module'        => 'purchase', 'document_type' => null, 'item_type' => 'goods',
            'is_stock_item' => true, 'item_category_id' => $category->id, 'warehouse_id' => $warehouse->id, 'priority' => 0,
        ]);

        $resolved = app(DocumentDefaultsResolver::class)->resolveForItems(
            DefaultsDocumentType::PurchaseOrder,
            [$stockItem->id, $serviceItem->id],
        );

        $this->assertSame([], $resolved[$stockItem->id]['tax_ids']);
        $this->assertSame($warehouse->id, $resolved[$stockItem->id]['warehouse_id']);
        $this->assertSame($warehouse->id, $resolved[$stockItem->id]['warehouse']['id']);
        $this->assertSame([], $resolved[$stockItem->id]['taxes']);
        $this->assertTrue($resolved[$stockItem->id]['tax_optional'], 'Aturan tanpa pajak eksplisit cocok.');
        $this->assertSame([$tax->id], $resolved[$serviceItem->id]['tax_ids']);
        $this->assertSame($tax->id, $resolved[$serviceItem->id]['taxes'][0]['id']);
        $this->assertFalse($resolved[$serviceItem->id]['tax_optional'], 'Tanpa aturan cocok pajak tetap wajib.');
        $this->assertNull($resolved[$serviceItem->id]['warehouse_id']);
        $this->assertNull($resolved[$serviceItem->id]['warehouse']);
    }

    public function test_deleted_rule_references_fall_back_to_module_defaults(): void {
        $moduleTax       = Tax::query()->create(['name' => 'Module tax', 'rate' => 11]);
        $deletedRuleTax  = Tax::query()->create(['name' => 'Deleted rule tax', 'rate' => 5]);
        $moduleWarehouse = $this->createWarehouse('Module warehouse');
        $ruleWarehouse   = $this->createWarehouse('Rule warehouse');
        $category        = Category::query()->create(['name' => 'Conditional category', 'type' => 'inventory']);
        $item            = Item::factory()->create(['category_id' => $category->id, 'is_stock_item' => true]);

        PurchaseSetting::current()->fill([
            'default_tax_id'              => $moduleTax->id,
            'default_target_warehouse_id' => $moduleWarehouse->id,
        ])->save();
        DefaultTaxRule::query()->create([
            'module' => 'purchase', 'document_type' => 'purchase_order', 'item_category_id' => $category->id,
            'tax_id' => $deletedRuleTax->id, 'priority' => 0,
        ]);
        DefaultWarehouseRule::query()->create([
            'module'       => 'purchase', 'document_type' => 'purchase_order', 'item_category_id' => $category->id,
            'warehouse_id' => $ruleWarehouse->id, 'priority' => 0,
        ]);
        $deletedRuleTax->delete();
        $ruleWarehouse->delete();

        $resolved = app(DocumentDefaultsResolver::class)->resolveForItems(DefaultsDocumentType::PurchaseOrder, [$item->id]);

        $this->assertSame([$moduleTax->id], $resolved[$item->id]['tax_ids']);
        $this->assertSame($moduleTax->id, $resolved[$item->id]['taxes'][0]['id']);
        $this->assertFalse($resolved[$item->id]['tax_optional'], 'Referensi rusak bukan aturan tanpa pajak.');
        $this->assertSame($moduleWarehouse->id, $resolved[$item->id]['warehouse_id']);
        $this->assertSame($moduleWarehouse->id, $resolved[$item->id]['warehouse']['id']);
    }

    public function test_deleted_rule_references_fall_back_to_inventory_warehouse_then_empty(): void {
        $ruleWarehouse      = $this->createWarehouse('Rule warehouse');
        $inventoryWarehouse = $this->createWarehouse('Inventory warehouse');
        $ruleTax            = Tax::query()->create(['name' => 'Deleted rule tax', 'rate' => 5]);
        $category           = Category::query()->create(['name' => 'Fallback category', 'type' => 'inventory']);
        $item               = Item::factory()->create(['category_id' => $category->id, 'is_stock_item' => true]);

        DefaultTaxRule::query()->create(['module' => 'purchase', 'document_type' => 'purchase_order', 'item_category_id' => $category->id, 'tax_id' => $ruleTax->id, 'priority' => 0]);
        DefaultWarehouseRule::query()->create(['module' => 'purchase', 'document_type' => 'purchase_order', 'item_category_id' => $category->id, 'warehouse_id' => $ruleWarehouse->id, 'priority' => 0]);
        $ruleTax->delete();
        $ruleWarehouse->delete();
        $resolver = app(DocumentDefaultsResolver::class);

        // Tanpa default modul dan default Inventory: kosong, dan pajak tetap wajib.
        $resolved = $resolver->resolveForItems(DefaultsDocumentType::PurchaseOrder, [$item->id])[$item->id];
        $this->assertSame([], $resolved['tax_ids']);
        $this->assertSame([], $resolved['taxes']);
        $this->assertFalse($resolved['tax_optional']);
        $this->assertNull($resolved['warehouse_id']);

        // Default Inventory dipakai bila default modul kosong.
        InventorySetting::current()->fill(['default_warehouse_id' => $inventoryWarehouse->id])->save();
        $resolved = $resolver->resolveForItems(DefaultsDocumentType::PurchaseOrder, [$item->id])[$item->id];
        $this->assertSame($inventoryWarehouse->id, $resolved['warehouse_id']);
    }

    public function test_explicit_no_tax_rule_is_optional_and_not_a_broken_reference(): void {
        $moduleTax = Tax::query()->create(['name' => 'Module tax', 'rate' => 11]);
        $category  = Category::query()->create(['name' => 'No tax category', 'type' => 'inventory']);
        $matching  = Item::factory()->create(['category_id' => $category->id]);
        $other     = Item::factory()->create(['category_id' => null]);
        SalesSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();
        DefaultTaxRule::query()->create(['module' => 'sales', 'document_type' => 'sales_order', 'item_category_id' => $category->id, 'tax_id' => null, 'priority' => 0]);
        $resolver = app(DocumentDefaultsResolver::class);

        $resolved = $resolver->resolveForItems(DefaultsDocumentType::SalesOrder, [$matching->id, $other->id]);
        $this->assertSame([], $resolved[$matching->id]['tax_ids']);
        $this->assertTrue($resolved[$matching->id]['tax_optional']);
        $this->assertSame([$moduleTax->id], $resolved[$other->id]['tax_ids']);
        $this->assertFalse($resolved[$other->id]['tax_optional']);

        // Jenis dokumen lain tidak cocok dengan aturan: pajak wajib.
        $invoice = $resolver->resolveForItems(DefaultsDocumentType::SalesInvoice, [$matching->id]);
        $this->assertFalse($invoice[$matching->id]['tax_optional']);
    }

    public function test_resolved_taxes_follow_tax_ids_order_and_shape_of_the_form_tax_object(): void {
        $tax  = Tax::query()->create(['name' => 'Rule tax', 'rate' => 7.5]);
        $item = Item::factory()->create(['type' => 'inventory']);
        DefaultTaxRule::query()->create(['module' => 'purchase', 'document_type' => 'purchase_order', 'item_type' => 'inventory', 'tax_id' => $tax->id, 'priority' => 0]);

        $resolved = app(DocumentDefaultsResolver::class)->resolveForItems(DefaultsDocumentType::PurchaseOrder, [$item->id])[$item->id];

        $this->assertSame([$tax->id], $resolved['tax_ids']);
        $this->assertSame($tax->id, $resolved['taxes'][0]['id']);
        $this->assertSame('Rule tax', $resolved['taxes'][0]['name']);
        $this->assertEquals(7.5, $resolved['taxes'][0]['rate']);
        $this->assertSame(Tax::class, $resolved['taxes'][0]['thisModel']);
        $this->assertSame(Tax::templateLink(), $resolved['taxes'][0]['templateLink']);
    }

    public function test_saving_rules_normalizes_category_ulids_before_duplicate_detection(): void {
        $category = Category::query()->create(['name' => 'Case normalization category', 'type' => 'inventory']);
        $rule     = [
            'document_type'    => 'purchase_order',
            'item_type'        => null,
            'is_stock_item'    => null,
            'item_category_id' => $category->id,
            'tax_id'           => null,
            'priority'         => 0,
        ];

        try {
            app(ModuleDefaultRulesService::class)->replace('purchase', [
                'tax_rules'       => [$rule, [...$rule, 'item_category_id' => strtoupper($category->id)]],
                'warehouse_rules' => [],
            ]);
            $this->fail('Expected differently-cased ULIDs for the same condition to be rejected as duplicates.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('tax_rules.1.item_category_id', $exception->errors());
        }

        $this->assertDatabaseCount('default_tax_rules', 0);
    }

    public function test_saving_lowercase_reference_ulids_resolves_canonical_tax_and_warehouse(): void {
        $tax       = Tax::query()->create(['name' => 'Case-insensitive tax', 'rate' => 11]);
        $warehouse = $this->createWarehouse('Case-insensitive warehouse');
        $item      = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true]);

        app(ModuleDefaultRulesService::class)->replace('purchase', [
            'tax_rules' => [[
                'document_type'    => 'purchase_order', 'item_type' => null, 'is_stock_item' => true,
                'item_category_id' => null, 'tax_id' => strtolower($tax->id), 'priority' => 0,
            ]],
            'warehouse_rules' => [[
                'document_type'    => 'purchase_order', 'item_type' => null, 'is_stock_item' => true,
                'item_category_id' => null, 'warehouse_id' => strtolower($warehouse->id), 'priority' => 0,
            ]],
        ]);

        $resolved = app(DocumentDefaultsResolver::class)->resolveForItems(DefaultsDocumentType::PurchaseOrder, [$item->id]);

        $this->assertSame([$tax->id], $resolved[$item->id]['tax_ids']);
        $this->assertSame($warehouse->id, $resolved[$item->id]['warehouse_id']);
    }

    public function test_resolving_defaults_does_not_create_missing_settings(): void {
        $item = Item::factory()->create();

        app(DocumentDefaultsResolver::class)->resolveForItems(
            DefaultsDocumentType::PurchaseOrder,
            [$item->id],
        );

        $this->assertSame(0, PurchaseSetting::query()->count());
        $this->assertSame(0, InventorySetting::query()->count());
    }

    public function test_resolver_matches_module_defaults_for_each_document_type_without_rules(): void {
        $tax                                    = Tax::query()->create(['name' => 'Default tax', 'rate' => 11]);
        $warehouse                              = $this->createWarehouse('Default warehouse');
        $inventorySetting                       = InventorySetting::current();
        $inventorySetting->default_warehouse_id = $warehouse->id;
        $inventorySetting->save();
        PurchaseSetting::current()->fill([
            'default_tax_id'              => $tax->id,
            'default_target_warehouse_id' => $warehouse->id,
        ])->save();
        SalesSetting::current()->fill([
            'default_tax_id'              => $tax->id,
            'default_source_warehouse_id' => $warehouse->id,
        ])->save();
        $item = Item::factory()->create(['is_stock_item' => true]);

        foreach (DefaultsDocumentType::cases() as $type) {
            $moduleDefaults = app(DocumentDefaultsResolver::class)->defaultsFor($type);
            $resolved       = app(DocumentDefaultsResolver::class)->resolveForItems($type, [$item->id]);

            $this->assertSame(
                $moduleDefaults['tax_id'] === null ? [] : [$moduleDefaults['tax_id']],
                $resolved[$item->id]['tax_ids'],
                $type->value,
            );
            $this->assertSame($moduleDefaults['warehouse_id'], $resolved[$item->id]['warehouse_id'], $type->value);
            if (! $type->supportsWarehouseDefault()) {
                $this->assertNull($resolved[$item->id]['warehouse_id'], $type->value);
            }
        }
    }

    public function test_resolver_ignores_warehouse_rules_for_unsupported_document_types(): void {
        $warehouse = $this->createWarehouse('Rule warehouse');
        $item      = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true]);
        foreach (['purchase', 'sales'] as $module) {
            DefaultWarehouseRule::query()->create([
                'module'        => $module, 'document_type' => null, 'item_type' => 'goods',
                'is_stock_item' => true, 'warehouse_id' => $warehouse->id, 'priority' => 0,
            ]);
        }

        foreach ([DefaultsDocumentType::PurchaseInvoice, DefaultsDocumentType::SalesInvoice, DefaultsDocumentType::Quotation] as $type) {
            $resolved = app(DocumentDefaultsResolver::class)->resolveForItems($type, [$item->id]);
            $this->assertNull($resolved[$item->id]['warehouse_id'], $type->value);
            $this->assertNull($resolved[$item->id]['warehouse'], $type->value);
        }

        foreach ([DefaultsDocumentType::PurchaseOrder, DefaultsDocumentType::PurchaseReceipt, DefaultsDocumentType::SalesOrder, DefaultsDocumentType::DeliveryNote] as $type) {
            $resolved = app(DocumentDefaultsResolver::class)->resolveForItems($type, [$item->id]);
            $this->assertSame($warehouse->id, $resolved[$item->id]['warehouse_id'], $type->value);
        }
    }

    public function test_warehouse_rules_reject_unsupported_document_types(): void {
        $this->actingAsRuleWriter('purchase')
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules'       => [],
                'warehouse_rules' => [[
                    'document_type'    => 'purchase_invoice', 'item_type' => 'goods', 'is_stock_item' => true,
                    'item_category_id' => null, 'warehouse_id' => $this->createWarehouse('Unsupported rule')->id, 'priority' => 0,
                ]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('warehouse_rules.0.document_type');
    }

    public function test_stale_rule_snapshot_is_rejected_without_deleting_concurrent_changes(): void {
        $version = app(ModuleDefaultRulesService::class)->version('purchase');
        $newRule = DefaultTaxRule::factory()->create([
            'module' => 'purchase', 'document_type' => 'purchase_order', 'item_type' => 'service',
        ]);
        $afterConcurrentSave = $this->conditionalDefaultsSnapshot();

        $this->actingAsRuleWriter('purchase')
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'rules_version'   => $version,
                'tax_rules'       => [],
                'warehouse_rules' => [],
            ])
            ->assertStatus(409);

        $this->assertSame($afterConcurrentSave, $this->conditionalDefaultsSnapshot());
        $this->assertDatabaseHas('default_tax_rules', ['id' => $newRule->id, 'module' => 'purchase']);
    }

    public function test_rule_save_requires_a_version_token(): void {
        $this->actingAsRuleWriter('purchase')
            ->call(
                'PUT',
                route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']),
                ['tax_rules' => [], 'warehouse_rules' => []],
                [],
                [],
                ['HTTP_ACCEPT' => 'application/json'],
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rules_version');
    }

    public function test_resolving_defaults_does_not_create_module_settings(): void {
        $item = Item::factory()->create();

        app(DocumentDefaultsResolver::class)->resolveForItems(
            DefaultsDocumentType::PurchaseOrder,
            [$item->id],
        );

        $this->assertSame(0, PurchaseSetting::query()->count());
        $this->assertSame(0, InventorySetting::query()->count());
    }

    public function test_resolve_endpoint_returns_item_map_and_executes_constant_rule_and_item_queries(): void {
        $user        = User::factory()->create();
        $first       = Item::factory()->create();
        $second      = Item::factory()->create();
        $permissions = [PurchaseOrder::class => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, PurchaseOrder::class, ['read' => true]);
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = strtolower($query->sql);
        });

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->postJson(route('defaults.resolve'), [
                'document_type' => 'purchase_order',
                'items'         => [['item_id' => $first->id], ['item_id' => $second->id]],
            ])
            ->assertOk()
            ->assertExactJson(['items' => [
                $first->id  => ['tax_ids' => [], 'taxes' => [], 'tax_optional' => false, 'warehouse_id' => null, 'warehouse' => null],
                $second->id => ['tax_ids' => [], 'taxes' => [], 'tax_optional' => false, 'warehouse_id' => null, 'warehouse' => null],
            ]]);

        $normalizedQueries = array_map(fn (string $sql): string => str_replace(['`', '"'], '', $sql), $queries);
        $this->assertSame(1, count(array_filter($normalizedQueries, fn (string $sql): bool => str_contains($sql, 'from items'))));
        $this->assertSame(1, count(array_filter($normalizedQueries, fn (string $sql): bool => str_contains($sql, 'from default_tax_rules'))));
        $this->assertSame(1, count(array_filter($normalizedQueries, fn (string $sql): bool => str_contains($sql, 'from default_warehouse_rules'))));
    }

    public function test_resolve_endpoint_requires_document_read_or_create_permission_and_limits_items(): void {
        $user = User::factory()->create();
        $this->actingAs($user)->withSession(['permissions' => []])
            ->postJson(route('defaults.resolve'), ['document_type' => 'purchase_order', 'items' => [['item_id' => (string) Str::ulid()]]])
            ->assertForbidden();

        $permissions = [PurchaseOrder::class => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, PurchaseOrder::class, ['read' => true]);
        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->postJson(route('defaults.resolve'), [
                'document_type' => 'purchase_order',
                'items'         => array_map(fn (): array => ['item_id' => (string) Str::ulid()], range(1, 101)),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');
    }

    public function test_module_settings_permission_can_preview_its_module_defaults_without_document_permission(): void {
        $user = User::factory()->create();
        $item = Item::factory()->create();

        foreach ([
            ['purchase_order', PurchaseSetting::class],
            ['sales_invoice', SalesSetting::class],
        ] as [$documentType, $settingsClass]) {
            $permissions = [$settingsClass => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
            $this->grantCurrentPermission($user, $settingsClass, ['read' => true]);
            $this->actingAs($user)->withSession(['permissions' => $permissions])
                ->postJson(route('defaults.resolve'), [
                    'document_type' => $documentType,
                    'items'         => [['item_id' => $item->id]],
                ])
                ->assertOk()
                ->assertJsonPath("items.{$item->id}.tax_ids", []);
        }

        $purchaseOnlyUser = User::factory()->create();
        $purchaseOnly     = [PurchaseSetting::class => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($purchaseOnlyUser, PurchaseSetting::class, ['read' => true]);
        $this->actingAs($purchaseOnlyUser)->withSession(['permissions' => $purchaseOnly])
            ->postJson(route('defaults.resolve'), [
                'document_type' => 'sales_invoice',
                'items'         => [['item_id' => $item->id]],
            ])
            ->assertForbidden();
    }

    public function test_update_rejects_duplicate_unconditional_and_non_stock_warehouse_rules_and_audits_saved_rules(): void {
        $user        = User::factory()->create();
        $warehouse   = $this->createWarehouse('Rule warehouse');
        $permissions = [PurchaseSetting::class => [0 => [['permissions' => ['write' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, PurchaseSetting::class, ['write' => true]);
        $validTax = ['document_type' => 'purchase_order', 'item_type' => 'inventory', 'is_stock_item' => null, 'item_category_id' => null, 'tax_id' => null, 'priority' => 0];

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules' => [$validTax, $validTax], 'warehouse_rules' => [],
            ])
            ->assertSessionHasErrors('tax_rules.1.item_category_id');

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules' => [['tax_id' => null]], 'warehouse_rules' => [],
            ])
            ->assertSessionHasErrors('tax_rules.0.item_type');

        $inactiveTax = Tax::query()->create(['name' => 'Inactive tax', 'rate' => 11]);
        $inactiveTax->delete();
        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules' => [[...$validTax, 'tax_id' => $inactiveTax->id]], 'warehouse_rules' => [],
            ])
            ->assertSessionHasErrors('tax_rules.0.tax_id');

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules'       => [],
                'warehouse_rules' => [[
                    'document_type'    => null, 'item_type' => 'service', 'is_stock_item' => false,
                    'item_category_id' => null, 'warehouse_id' => $warehouse->id, 'priority' => 0,
                ]],
            ])
            ->assertSessionHasErrors('warehouse_rules.0.is_stock_item');

        $inactiveWarehouse = $this->createWarehouse('Inactive warehouse');
        $inactiveWarehouse->delete();
        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules'       => [],
                'warehouse_rules' => [[
                    'document_type'    => null, 'item_type' => 'inventory', 'is_stock_item' => true,
                    'item_category_id' => null, 'warehouse_id' => $inactiveWarehouse->id, 'priority' => 0,
                ]],
            ])
            ->assertSessionHasErrors('warehouse_rules.0.warehouse_id');

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules' => [$validTax], 'warehouse_rules' => [],
            ])
            ->assertRedirect();

        $rule = DefaultTaxRule::query()->where('module', 'purchase')->firstOrFail();
        $this->assertDatabaseHas('logs', ['loggable_type' => DefaultTaxRule::class, 'loggable_id' => $rule->id, 'action' => 'created']);

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), ['tax_rules' => [], 'warehouse_rules' => []])
            ->assertRedirect();

        $this->assertDatabaseHas('logs', ['loggable_type' => DefaultTaxRule::class, 'loggable_id' => $rule->id, 'action' => 'deleted']);
    }

    public function test_resolve_endpoint_validates_non_string_document_type_without_server_error(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('defaults.resolve'), [
                'document_type' => ['purchase_order'],
                'items'         => [['item_id' => (string) Str::ulid()]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('document_type');
    }

    public function test_resolved_global_warehouse_rule_includes_reference_when_current_branch_scope_excludes_it(): void {
        $user                = User::factory()->create();
        $currentBranch       = Branch::query()->create(['name' => 'Current branch']);
        $configuredBranch    = Branch::query()->create(['name' => 'Configured branch']);
        $configuredWarehouse = Warehouse::query()->create([
            'branch_id' => $configuredBranch->id,
            'name'      => 'Global configured warehouse',
            'code'      => 'GLOBAL-WH',
        ]);
        $item = Item::factory()->create(['type' => 'goods', 'is_stock_item' => true]);

        DefaultWarehouseRule::query()->create([
            'module'        => 'purchase',
            'document_type' => 'purchase_order',
            'item_type'     => 'goods',
            'is_stock_item' => true,
            'warehouse_id'  => $configuredWarehouse->id,
            'priority'      => 0,
        ]);

        $this->actingAs($user)->withSession(['currentBranch' => $currentBranch->id]);
        $resolved = app(DocumentDefaultsResolver::class)->resolveForItems(
            DefaultsDocumentType::PurchaseOrder,
            [$item->id],
        );

        $this->assertSame($configuredWarehouse->id, $resolved[$item->id]['warehouse_id']);
        $this->assertSame($configuredWarehouse->id, $resolved[$item->id]['warehouse']['id']);
        $this->assertSame($configuredBranch->id, $resolved[$item->id]['warehouse']['branch_id']);
    }

    public function test_settings_pages_expose_reference_objects_for_rule_tables(): void {
        $user     = User::factory()->create();
        $tax      = Tax::query()->create(['name' => 'Sales tax', 'rate' => 11]);
        $category = Category::query()->create(['name' => 'Parts', 'type' => 'inventory']);
        DefaultTaxRule::query()->create([
            'module'        => 'sales', 'document_type' => 'sales_order', 'item_type' => 'goods',
            'is_stock_item' => true, 'item_category_id' => $category->id, 'tax_id' => $tax->id, 'priority' => 3,
        ]);
        $permissions = [SalesSetting::class => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, SalesSetting::class, ['read' => true]);

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->get(route('moduleSettings.sales.show'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaultTaxRules.0.tax.id', $tax->id)
                ->where('defaultTaxRules.0.item_category.id', $category->id)
                ->has('defaultWarehouseRules'));
    }

    public function test_settings_rules_eager_load_warehouse_branches_for_serialization(): void {
        $firstWarehouse  = $this->createWarehouse('First rule warehouse');
        $secondWarehouse = $this->createWarehouse('Second rule warehouse');
        foreach ([$firstWarehouse, $secondWarehouse] as $index => $warehouse) {
            DefaultWarehouseRule::query()->create([
                'module'        => 'purchase',
                'document_type' => 'purchase_order',
                'item_type'     => 'goods',
                'is_stock_item' => true,
                'warehouse_id'  => $warehouse->id,
                'priority'      => $index,
            ]);
        }

        DB::enableQueryLog();
        [, $warehouseRules] = app(ModuleDefaultRulesService::class)->forModule('purchase');
        foreach ($warehouseRules as $rule) {
            $rule->warehouse->toArray();
        }
        $branchQueries = collect(DB::getQueryLog())
            ->filter(fn (array $query): bool => str_contains(strtolower($query['query']), 'branches'))
            ->count();
        DB::disableQueryLog();

        $this->assertSame(1, $branchQueries);
    }

    public function test_rule_validation_messages_follow_the_active_locale(): void {
        $this->app->setLocale('id');
        $user        = User::factory()->create();
        $permissions = [PurchaseSetting::class => [0 => [['permissions' => ['write' => true], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, PurchaseSetting::class, ['write' => true]);

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->put(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules'       => [['tax_id' => null]],
                'warehouse_rules' => [],
            ])
            ->assertSessionHasErrors('tax_rules.0.item_type');

        $this->assertSame(
            __('purchase.setting.rules.server.condition_required'),
            session('errors')->first('tax_rules.0.item_type'),
        );
    }

    public function test_conditional_defaults_endpoints_recheck_disabled_roles_instead_of_trusting_stale_session_permissions(): void {
        $user             = User::factory()->create();
        $item             = Item::factory()->create();
        $permission       = $this->grantCurrentPermission($user, PurchaseSetting::class, ['write' => true]);
        $stalePermissions = [PurchaseSetting::class => [0 => [[
            'permissions'  => ['read' => true, 'write' => true],
            'only_creator' => false,
        ]]]];

        $this->actingAs($user)->withSession(['permissions' => $stalePermissions])
            ->postJson(route('defaults.resolve'), [
                'document_type' => 'purchase_order',
                'items'         => [['item_id' => $item->id]],
            ])
            ->assertOk();

        $this->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
            'tax_rules'       => [],
            'warehouse_rules' => [],
        ])->assertRedirect();

        $this->putJson(route('moduleSettings.purchase.update'), [
            'rate_change_action'             => 'warn',
            'over_billing_tolerance_percent' => 5,
            'tax_rules'                      => [],
            'warehouse_rules'                => [],
        ])->assertRedirect();

        $permission->role->update(['is_disabled' => true]);

        $this->postJson(route('defaults.resolve'), [
            'document_type' => 'purchase_order',
            'items'         => [['item_id' => $item->id]],
        ])->assertForbidden();

        $this->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
            'tax_rules'       => [],
            'warehouse_rules' => [],
        ])->assertForbidden();

        $this->putJson(route('moduleSettings.purchase.update'), [
            'rate_change_action'             => 'warn',
            'over_billing_tolerance_percent' => 5,
            'tax_rules'                      => [],
            'warehouse_rules'                => [],
        ])->assertForbidden();
    }

    #[DataProvider('moduleProvider')]
    public function test_module_settings_page_rechecks_disabled_roles_instead_of_trusting_stale_session_permissions(string $module): void {
        $settingClass = $module === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $user         = User::factory()->create();
        $permission   = $this->grantCurrentPermission($user, $settingClass, ['read' => true]);
        $permissions  = [$settingClass => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];

        $this->actingAs($user)->withSession(['permissions' => $permissions]);
        $permission->role->update(['is_disabled' => true]);

        $this->get(route("moduleSettings.{$module}.show"))->assertForbidden();
    }

    #[DataProvider('moduleProvider')]
    public function test_module_settings_only_save_rechecks_disabled_roles_without_rule_payload(string $module): void {
        $settingClass = $module === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $user         = User::factory()->create();
        $permission   = $this->grantCurrentPermission($user, $settingClass, ['write' => true]);
        $permissions  = [$settingClass => [0 => [['permissions' => ['write' => true], 'only_creator' => false]]]];
        $payload      = ['rate_change_action' => 'stop'];

        if ($module === 'sales') {
            $payload['below_cost_action'] = 'warn';
        }

        $settingClass::current()->fill(['rate_change_action' => 'warn'])->save();
        $this->actingAs($user)->withSession(['permissions' => $permissions]);
        $permission->role->update(['is_disabled' => true]);

        $this->putJson(route("moduleSettings.{$module}.update"), $payload)->assertForbidden();
        $this->assertSame('warn', $settingClass::current()->fresh()->rate_change_action);
    }

    #[DataProvider('moduleProvider')]
    public function test_read_only_user_cannot_replace_or_delete_rules(string $module): void {
        $taxRule       = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null]);
        $warehouseRule = DefaultWarehouseRule::factory()->create(['module' => $module, 'document_type' => null]);
        $before        = $this->conditionalDefaultsSnapshot();
        $user          = User::factory()->create();
        $settingClass  = $module === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $permissions   = [$settingClass => [0 => [['permissions' => ['read' => true, 'write' => false], 'only_creator' => false]]]];
        $this->grantCurrentPermission($user, $settingClass, ['read' => true]);

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->get(route("moduleSettings.{$module}.show"))->assertOk();

        foreach ([
            ['tax_rules' => [], 'warehouse_rules' => []],
            [
                'tax_rules'       => [[...$this->rulePayload($taxRule), 'priority' => 8]],
                'warehouse_rules' => [[...$this->rulePayload($warehouseRule), 'priority' => 8]],
            ],
        ] as $payload) {
            $this->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), $payload)
                ->assertForbidden();
            $this->assertSame($before, $this->conditionalDefaultsSnapshot());
        }
    }

    #[DataProvider('foreignRuleProvider')]
    public function test_rule_id_from_another_module_cannot_be_adopted_or_mutated(string $module, string $field): void {
        $otherModule   = $module === 'purchase' ? 'sales' : 'purchase';
        $taxRule       = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null]);
        $warehouseRule = DefaultWarehouseRule::factory()->create(['module' => $module, 'document_type' => null]);
        $foreignRule   = $field === 'tax_rules'
            ? DefaultTaxRule::factory()->create(['module' => $otherModule, 'document_type' => null])
            : DefaultWarehouseRule::factory()->create(['module' => $otherModule, 'document_type' => null]);
        $payload = [
            'tax_rules'       => [$this->rulePayload($taxRule)],
            'warehouse_rules' => [$this->rulePayload($warehouseRule)],
        ];
        $payload[$field][] = [...$this->rulePayload($foreignRule), 'item_type' => 'service', 'is_stock_item' => null, 'priority' => 9];
        $before            = $this->conditionalDefaultsSnapshot();

        $this->actingAsRuleWriter($module)
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors("{$field}.1.id");

        $this->assertSame($before, $this->conditionalDefaultsSnapshot());
        $this->assertSame($otherModule, $foreignRule->fresh()->module);
    }

    #[DataProvider('invalidModuleProvider')]
    public function test_invalid_module_is_denied_without_mutation(string $module): void {
        DefaultTaxRule::factory()->create();
        DefaultWarehouseRule::factory()->create();
        $before = $this->conditionalDefaultsSnapshot();

        $this->actingAsRuleWriter('purchase')
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), [
                'tax_rules' => [], 'warehouse_rules' => [],
            ])->assertNotFound();

        $this->assertSame($before, $this->conditionalDefaultsSnapshot());
    }

    #[DataProvider('moduleProvider')]
    public function test_late_warehouse_validation_failure_rolls_back_both_collections_and_audit_records(string $module): void {
        $payload        = $this->replacementWithLateFailure($module);
        $before         = $this->conditionalDefaultsSnapshot();
        $observedWrites = [];
        DB::listen(function ($query) use (&$observedWrites): void {
            $sql = strtolower(str_replace(['`', '"'], '', $query->sql));
            if (preg_match('/^(insert into|update|delete from) (default_tax_rules|default_warehouse_rules)\b/', $sql, $matches)) {
                $observedWrites[] = [$matches[1], $matches[2]];
            }
        });

        $this->actingAsRuleWriter($module)
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('warehouse_rules.2.id');

        $this->assertSame($before, $this->conditionalDefaultsSnapshot());
        $this->assertContains(['update', 'default_tax_rules'], $observedWrites);
        $this->assertContains(['insert into', 'default_tax_rules'], $observedWrites);
        $this->assertContains(['delete from', 'default_tax_rules'], $observedWrites);
        $this->assertContains(['update', 'default_warehouse_rules'], $observedWrites);
        $this->assertContains(['insert into', 'default_warehouse_rules'], $observedWrites);
    }

    #[DataProvider('moduleProvider')]
    public function test_rolled_back_replacement_does_not_persist_audit_records(string $module): void {
        $payload          = $this->replacementWithLateFailure($module);
        $before           = $this->conditionalDefaultsSnapshot();
        $publishedActions = [];
        Event::listen(AuditableModelSaved::class, function (AuditableModelSaved $event) use (&$publishedActions): void {
            if ($event->model instanceof DefaultTaxRule || $event->model instanceof DefaultWarehouseRule) {
                $publishedActions[] = [get_class($event->model), $event->action];
            }
        });

        $this->actingAsRuleWriter($module)
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('warehouse_rules.2.id');

        $this->assertSame($before, $this->conditionalDefaultsSnapshot());
        $this->assertNotEmpty($publishedActions, 'Audit events are recorded synchronously inside the transaction.');
    }

    public function test_audit_record_failure_rolls_back_default_rule_changes(): void {
        Event::listen(AuditableModelSaved::class, static function (AuditableModelSaved $event): void {
            if ($event->model instanceof DefaultTaxRule && $event->action === 'created') {
                throw new \RuntimeException('Audit storage unavailable.');
            }
        });

        $this->actingAsRuleWriter('purchase')
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => 'purchase']), [
                'tax_rules'       => [['item_type' => 'inventory', 'tax_id' => null]],
                'warehouse_rules' => [],
            ])
            ->assertServerError();

        $this->assertDatabaseCount('default_tax_rules', 0);
        $this->assertDatabaseMissing('logs', ['loggable_type' => DefaultTaxRule::class]);
    }

    public static function moduleProvider(): array {
        return ['purchase' => ['purchase'], 'sales' => ['sales']];
    }

    public static function foreignRuleProvider(): array {
        return [
            'sales tax into purchase'       => ['purchase', 'tax_rules'],
            'sales warehouse into purchase' => ['purchase', 'warehouse_rules'],
            'purchase tax into sales'       => ['sales', 'tax_rules'],
            'purchase warehouse into sales' => ['sales', 'warehouse_rules'],
        ];
    }

    public static function invalidModuleProvider(): array {
        return ['unsupported' => ['inventory'], 'unknown' => ['unknown'], 'wrong case' => ['Sales']];
    }

    private function actingAsRuleWriter(string $module): static {
        $settingClass = $module === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $user         = User::factory()->create();
        $this->grantCurrentPermission($user, $settingClass, ['write' => true]);

        return $this->actingAs($user)->withSession([
            'permissions' => [$settingClass => [0 => [['permissions' => ['write' => true], 'only_creator' => false]]]],
        ]);
    }

    /** @param array<string, bool> $actions */
    private function grantCurrentPermission(User $user, string $model, array $actions): RolePermission {
        $role = Role::query()->create(['name' => 'Conditional defaults ' . Str::ulid()]);
        $user->roles()->attach($role);
        $permission = Permission::query()->firstOrCreate(['model' => $model], [
            'module'      => 'Setting',
            'name'        => class_basename($model),
            'permissions' => array_keys($actions),
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

    private function rulePayload(DefaultTaxRule|DefaultWarehouseRule $rule): array {
        return array_diff_key($rule->auditData(), ['module' => true]);
    }

    private function replacementWithLateFailure(string $module): array {
        $taxRule = DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null]);
        DefaultTaxRule::factory()->create(['module' => $module, 'document_type' => null, 'item_type' => 'service']);
        $warehouseRule = DefaultWarehouseRule::factory()->create(['module' => $module, 'document_type' => null]);

        return [
            'tax_rules' => [
                [...$this->rulePayload($taxRule), 'priority' => 10],
                ['item_type' => 'service', 'tax_id' => null, 'priority' => 20],
            ],
            'warehouse_rules' => [
                [...$this->rulePayload($warehouseRule), 'priority' => 10],
                ['item_type' => 'service', 'warehouse_id' => $warehouseRule->warehouse_id, 'priority' => 20],
                ['id'        => (string) Str::ulid(), 'item_type' => 'vehicle', 'warehouse_id' => $warehouseRule->warehouse_id],
            ],
        ];
    }

    private function conditionalDefaultsSnapshot(): array {
        return collect(['default_tax_rules', 'default_warehouse_rules', 'logs'])
            ->mapWithKeys(fn (string $table): array => [$table => DB::table($table)
                ->when($table === 'logs', fn ($query) => $query->whereIn('loggable_type', [DefaultTaxRule::class, DefaultWarehouseRule::class]))
                ->orderBy('id')->get()->map(fn (object $record): array => (array) $record)->all()])
            ->all();
    }

    private function createWarehouse(string $name): Warehouse {
        $branch = Branch::query()->create(['name' => $name . ' branch']);

        return Warehouse::query()->create([
            'branch_id' => $branch->id,
            'name'      => $name,
            'code'      => strtoupper(substr(sha1($name), 0, 8)),
        ]);
    }
}
