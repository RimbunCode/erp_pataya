<?php

namespace Tests\Feature\Settings;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Branch;
use App\Models\CRM\Quotation;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesSetting;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DocumentDefaultsControllerTest extends TestCase {
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

    public function test_all_new_document_forms_receive_defaults_prop(): void {
        $user        = User::factory()->create();
        $permissions = [];

        foreach ([
            PurchaseOrder::class,
            PurchaseReceipt::class,
            PurchaseInvoice::class,
            SalesOrder::class,
            DeliveryNote::class,
            SalesInvoice::class,
            Quotation::class,
        ] as $model) {
            $permissions[$model] = [[[
                'model'        => $model,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => ['create' => true],
            ]]];
        }

        foreach ([
            'purchaseOrders.create',
            'purchaseReceipts.create',
            'purchaseInvoices.create',
            'salesOrders.create',
            'deliveryNotes.create',
            'salesInvoices.create',
            'quotations.create',
        ] as $routeName) {
            $this->actingAs($user)
                ->withSession(['permissions' => $permissions])
                ->get(route($routeName))
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->has('defaults')
                    ->where('defaults.tax_id', null)
                    ->where('defaults.warehouse_id', null)
                    ->where('defaults.payment_term_template', null));
        }
    }

    public function test_document_index_pages_receive_defaults_for_create_dialogs(): void {
        $user        = User::factory()->create();
        $permissions = [];

        foreach ([
            PurchaseOrder::class,
            PurchaseReceipt::class,
            PurchaseInvoice::class,
            SalesOrder::class,
            DeliveryNote::class,
            SalesInvoice::class,
            Quotation::class,
        ] as $model) {
            $permissions[$model] = [[[
                'model'        => $model,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => ['select' => true, 'read' => true, 'create' => true],
            ]]];
        }

        foreach ([
            'purchaseOrders.index',
            'purchaseReceipts.index',
            'purchaseInvoices.index',
            'salesOrders.index',
            'deliveryNotes.index',
            'salesInvoices.index',
            'quotations.index',
        ] as $routeName) {
            $this->actingAs($user)
                ->withSession(['permissions' => $permissions])
                ->get(route($routeName))
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->has('defaults')
                    ->where('defaults.tax_id', null)
                    ->where('defaults.warehouse_id', null)
                    ->where('defaults.payment_term_template', null));
        }
    }

    public function test_sales_order_create_receives_configured_tax_and_warehouse_defaults(): void {
        $user        = User::factory()->create();
        $permissions = [
            SalesOrder::class => [[[
                'model'        => SalesOrder::class,
                'level'        => 0,
                'only_creator' => false,
                'permissions'  => ['create' => true],
            ]]],
        ];
        $branch    = Branch::query()->create(['name' => 'Sales defaults test branch']);
        $tax       = Tax::query()->create(['name' => 'Sales defaults test tax', 'rate' => 11]);
        $warehouse = Warehouse::query()->create([
            'branch_id' => $branch->id,
            'name'      => 'Sales defaults test warehouse',
            'code'      => 'SDF-WH',
        ]);

        SalesSetting::current()->fill([
            'default_tax_id'              => $tax->id,
            'default_source_warehouse_id' => $warehouse->id,
        ])->save();

        $this->actingAs($user)
            ->withSession(['permissions' => $permissions])
            ->get(route('salesOrders.create'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('defaults.tax.id', $tax->id)
                ->where('defaults.tax.name', $tax->name)
                ->where('defaults.tax.thisModel', Tax::class)
                ->where('defaults.warehouse.id', $warehouse->id)
                ->where('defaults.warehouse.name', $warehouse->name)
                ->where('defaults.warehouse.thisModel', Warehouse::class));
    }
}
