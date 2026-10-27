<?php

namespace Tests\Feature\Settings;

use App\Enums\DefaultsDocumentType;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\Finances\Tax;
use App\Models\Inventory\Category;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Item;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use App\Services\Core\Setting\ModuleDefaultRulesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Tindak lanjut module-defaults-and-controls: gudang default halaman setting tanpa scope cabang,
 * respons resolusi default (`taxes`, `tax_optional`), dan validasi aturan default
 * (`item_type` sah, jenis dokumen berpajak) beserta pilihan untuk form.
 */
class ModuleDefaultsFollowUpTest extends TestCase {
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

    // --- B4: gudang default global --------------------------------------------------

    public static function settingsPageProvider(): array {
        return [
            'sales'     => ['sales', SalesSetting::class, 'default_source_warehouse_id', 'defaultSourceWarehouse', 'moduleSettings.sales.show'],
            'purchase'  => ['purchase', PurchaseSetting::class, 'default_target_warehouse_id', 'defaultTargetWarehouse', 'moduleSettings.purchase.show'],
            'inventory' => ['inventory', InventorySetting::class, 'default_warehouse_id', 'defaultWarehouse', 'moduleSettings.inventory.show'],
        ];
    }

    #[DataProvider('settingsPageProvider')]
    public function test_settings_page_loads_the_default_warehouse_outside_the_users_branch_scope(string $module, string $settingClass, string $column, string $prop, string $route): void {
        $warehouseBranch = Branch::query()->create(['name' => 'Warehouse branch']);
        $userBranch      = Branch::query()->create(['name' => 'User branch']);
        $warehouse       = Warehouse::query()->create(['branch_id' => $warehouseBranch->id, 'name' => 'Default warehouse', 'code' => 'DEFWH']);
        $settingClass::current()->fill([$column => $warehouse->id])->save();

        $user        = User::factory()->create();
        $permissions = [$settingClass => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantPermission($user, $settingClass, ['read' => true]);

        // Pengguna non-cabang-utama di cabang lain: scope cabang menyembunyikan gudang di cabang gudang.
        $this->actingAs($user)->withSession(['permissions' => $permissions, 'currentBranch' => $userBranch->id]);
        $this->assertNull(Warehouse::query()->find($warehouse->id), 'Prasyarat: scope cabang aktif.');

        $this->get(route($route))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where("{$prop}.id", $warehouse->id)
                ->where("{$prop}.branch.id", $warehouseBranch->id));
    }

    // --- B5: respons resolusi --------------------------------------------------------

    public function test_resolve_endpoint_returns_tax_objects_next_to_tax_ids_and_the_optional_flag(): void {
        $moduleTax = Tax::query()->create(['name' => 'Module tax', 'rate' => 11]);
        $category  = Category::query()->create(['name' => 'No tax goods', 'type' => 'inventory']);
        $taxed     = Item::factory()->create(['category_id' => null]);
        $untaxed   = Item::factory()->create(['category_id' => $category->id]);
        SalesSetting::current()->fill(['default_tax_id' => $moduleTax->id])->save();
        app(ModuleDefaultRulesService::class)->replace('sales', [
            'tax_rules' => [[
                'document_type'    => 'sales_order', 'item_type' => null, 'is_stock_item' => null,
                'item_category_id' => $category->id, 'tax_id' => null, 'priority' => 0,
            ]],
            'warehouse_rules' => [],
        ]);
        $user        = User::factory()->create();
        $permissions = [SalesOrder::class => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantPermission($user, SalesOrder::class, ['read' => true]);

        $response = $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->postJson(route('defaults.resolve'), [
                'document_type' => 'sales_order',
                'items'         => [['item_id' => $taxed->id], ['item_id' => $untaxed->id]],
            ])
            ->assertOk()
            ->assertJsonPath("items.{$taxed->id}.tax_ids", [$moduleTax->id])
            ->assertJsonPath("items.{$taxed->id}.taxes.0.id", $moduleTax->id)
            ->assertJsonPath("items.{$taxed->id}.taxes.0.name", 'Module tax')
            ->assertJsonPath("items.{$taxed->id}.taxes.0.rate", 11)
            ->assertJsonPath("items.{$taxed->id}.tax_optional", false)
            ->assertJsonPath("items.{$untaxed->id}.tax_ids", [])
            ->assertJsonPath("items.{$untaxed->id}.taxes", [])
            ->assertJsonPath("items.{$untaxed->id}.tax_optional", true);

        $this->assertSame(
            ['id', 'name', 'rate', 'templateLink', 'thisModel'],
            array_keys($response->json("items.{$taxed->id}.taxes.0")),
        );
    }

    // --- B8: validasi aturan default ---------------------------------------------------

    public function test_supports_tax_default_only_for_documents_with_a_per_row_tax(): void {
        $expected = [
            'purchase_order'   => true,
            'purchase_invoice' => true,
            'sales_order'      => true,
            'sales_invoice'    => true,
            'quotation'        => true,
            'purchase_receipt' => false,
            'delivery_note'    => false,
        ];

        foreach (DefaultsDocumentType::cases() as $type) {
            $this->assertSame($expected[$type->value], $type->supportsTaxDefault(), $type->value);
        }
    }

    /** @param  array<string, mixed>  $payload */
    private function putRules(string $module, array $payload): TestResponse {
        $settingClass = $module === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $user         = User::factory()->create();
        $this->grantPermission($user, $settingClass, ['write' => true]);

        return $this->actingAs($user)
            ->withSession(['permissions' => [$settingClass => [0 => [['permissions' => ['write' => true], 'only_creator' => false]]]]])
            ->putJson(route('moduleSettings.defaultRules.update', ['moduleKey' => $module]), [
                'rules_version' => app(ModuleDefaultRulesService::class)->version($module),
                ...$payload,
            ]);
    }

    /** @return array<string, mixed> */
    private function taxRule(array $over = []): array {
        return ['document_type' => 'purchase_order', 'item_type' => 'inventory', 'is_stock_item' => null, 'item_category_id' => null, 'tax_id' => Tax::query()->firstOrCreate(['name' => 'Rule tax'], ['rate' => 11])->id, 'priority' => 0, ...$over];
    }

    /** @return array<string, mixed> */
    private function warehouseRule(Warehouse $warehouse, array $over = []): array {
        return ['document_type' => 'purchase_order', 'item_type' => 'inventory', 'is_stock_item' => true, 'item_category_id' => null, 'warehouse_id' => $warehouse->id, 'priority' => 0, ...$over];
    }

    public function test_item_type_must_be_a_valid_item_type_for_tax_and_warehouse_rules(): void {
        $warehouse = $this->createWarehouse();

        $this->putRules('purchase', [
            'tax_rules'       => [$this->taxRule(['item_type' => 'goods'])],
            'warehouse_rules' => [$this->warehouseRule($warehouse, ['item_type' => 'electronics'])],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tax_rules.0.item_type', 'warehouse_rules.0.item_type']);

        foreach (Category::TYPES as $type) {
            $this->putRules('purchase', [
                'tax_rules'       => [$this->taxRule(['item_type' => $type])],
                'warehouse_rules' => [$this->warehouseRule($warehouse, ['item_type' => $type])],
            ])->assertRedirect();
        }
    }

    public function test_item_types_come_from_the_category_types_that_items_inherit(): void {
        $this->assertSame(['inventory', 'vehicle', 'service'], Category::TYPES);
    }

    public function test_tax_rules_reject_documents_without_a_per_row_tax_but_warehouse_rules_are_unaffected(): void {
        $warehouse = $this->createWarehouse();

        $this->putRules('purchase', ['tax_rules' => [$this->taxRule(['document_type' => 'purchase_receipt'])], 'warehouse_rules' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tax_rules.0.document_type');
        $this->putRules('sales', ['tax_rules' => [$this->taxRule(['document_type' => 'delivery_note'])], 'warehouse_rules' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tax_rules.0.document_type');

        // Aturan warehouse untuk Receipt tetap sah.
        $this->putRules('purchase', ['tax_rules' => [], 'warehouse_rules' => [$this->warehouseRule($warehouse, ['document_type' => 'purchase_receipt'])]])
            ->assertRedirect();

        // Dokumen berpajak diterima, begitu juga aturan lintas dokumen (document_type null).
        $this->putRules('purchase', ['tax_rules' => [
            $this->taxRule(['document_type' => 'purchase_invoice', 'item_type' => 'service']),
            $this->taxRule(['document_type' => null, 'item_type' => 'vehicle']),
        ], 'warehouse_rules' => []])->assertRedirect();
        $this->putRules('sales', ['tax_rules' => [
            $this->taxRule(['document_type' => 'quotation']),
            $this->taxRule(['document_type' => 'sales_order', 'item_type' => 'service']),
        ], 'warehouse_rules' => []])->assertRedirect();
    }

    #[DataProvider('moduleProvider')]
    public function test_settings_pages_expose_item_type_options_and_tax_document_types(string $module, string $settingClass): void {
        $user        = User::factory()->create();
        $permissions = [$settingClass => [0 => [['permissions' => ['read' => true], 'only_creator' => false]]]];
        $this->grantPermission($user, $settingClass, ['read' => true]);
        $this->app->setLocale('id');

        $expectedDocuments = $module === 'purchase'
            ? ['purchase_order', 'purchase_invoice']
            : ['sales_order', 'sales_invoice', 'quotation'];

        $this->actingAs($user)->withSession(['permissions' => $permissions])
            ->get(route("moduleSettings.{$module}.show"))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('itemTypeOptions', [
                    ['value' => 'inventory', 'label' => 'Inventaris'],
                    ['value' => 'vehicle', 'label' => 'Kendaraan'],
                    ['value' => 'service', 'label' => 'Jasa/Layanan'],
                ])
                ->where('taxDocumentTypes', $expectedDocuments));
    }

    public static function moduleProvider(): array {
        return ['purchase' => ['purchase', PurchaseSetting::class], 'sales' => ['sales', SalesSetting::class]];
    }

    // --- helpers -----------------------------------------------------------------------

    private function createWarehouse(): Warehouse {
        $branch = Branch::query()->create(['name' => 'Rule branch ' . Str::random(5)]);

        return Warehouse::query()->create(['branch_id' => $branch->id, 'name' => 'Rule warehouse', 'code' => strtoupper(Str::random(8))]);
    }

    /** @param  array<string, bool>  $actions */
    private function grantPermission(User $user, string $model, array $actions): RolePermission {
        $role = Role::query()->create(['name' => 'Follow up ' . Str::ulid()]);
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
}
