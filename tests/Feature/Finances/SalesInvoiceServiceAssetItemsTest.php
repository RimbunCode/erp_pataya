<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\Unit;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesSetting;
use App\Models\User\User;
use App\Services\Finances\SalesInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * SalesInvoiceService menyimpan satu `items[]` berisi baris SO dan baris bebas
 * (ItemVariant/Asset tanpa baris SO), dengan asset_id langsung pada SalesInvoiceItem.
 */
class SalesInvoiceServiceAssetItemsTest extends TestCase {
    use RefreshDatabase;

    private Item $assetItem;
    private string $salesOrderId;
    private string $customerId;
    private string $customerBranchId;
    private string $taxId;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, SalesOrder::class, SalesInvoice::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (! Schema::hasColumn('accounts', 'lft')) {
            Schema::table('accounts', function ($t) {
                $t->unsignedInteger('lft')->default(0);
                $t->unsignedInteger('rgt')->default(0);
                $t->unsignedInteger('depth')->default(0);
            });
        }

        Auth::login(User::factory()->create());

        $country        = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer       = CustomerFactory::new()->create(['country_id' => $country->code]);
        $customerBranch = Branch::where('branchable_type', Customer::class)
            ->where('branchable_id', $customer->id)
            ->where('is_main_branch', true)
            ->firstOrFail();

        $this->customerId       = $customer->id;
        $this->customerBranchId = $customerBranch->id;
        $this->taxId            = TaxFactory::new()->create(['rate' => 0])->id;
        $this->assetItem        = Item::factory()->create(['is_fixed_asset' => true, 'is_stock_item' => false]);

        $this->salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'            => $this->salesOrderId,
            'code'          => 'SO-TEST-' . Str::random(8),
            'date'          => now(),
            'customer_id'   => $this->customerId,
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    private function makeSalesOrderItem(bool $fixedAsset, ?Item $item = null): string {
        $item ??= $fixedAsset ? $this->assetItem : Item::factory()->create(['is_fixed_asset' => false]);
        $asset   = $fixedAsset ? $this->makeAsset() : null;
        $variant = $fixedAsset ? null : ItemVariantFactory::new()->create(['item_id' => $item->id, 'is_stock_item' => true]);

        $soItemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'             => $soItemId,
            'sales_order_id' => $this->salesOrderId,
            'item_id'        => $variant?->id,
            'asset_id'       => $asset?->id,
            'quantity'       => 10,
            'price'          => 1000,
            'tax_id'         => $this->taxId,
            'tax_rate'       => 0,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $soItemId;
    }

    private function makeAsset(): Asset {
        $category = AssetCategory::factory()->create();

        $asset = Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $this->assetItem->id]);
        $asset->forceFill(['status' => [FormStatus::ACTIVE]])->save();

        return $asset;
    }

    /**
     * @return array<string,mixed>
     */
    private function row(string $soItemId, float $quantity, array $extra = []): array {
        $assetId = DB::table('sales_order_items')->where('id', $soItemId)->value('asset_id');

        return [
            'id'               => (string) Str::ulid(),
            'sales_order_item' => ['id' => $soItemId],
            ...($assetId ? ['asset' => ['id' => $assetId]] : []),
            ...($assetId ? [] : ['unit' => ['id' => null]]),
            'tax'      => ['id' => $this->taxId],
            'quantity' => $quantity,
            'price'    => 1000,
            ...$extra,
        ];
    }

    /**
     * @param  array<string,mixed>  $lists
     * @return array<string,mixed>
     */
    private function payload(array $lists): array {
        $debit  = Account::firstOrCreate(['account_number' => '1200'], ['account_name' => 'AR', 'root_type' => 'asset', 'account_type' => 'accounts_receivable', 'report_type' => 'balance_sheet']);
        $income = Account::firstOrCreate(['account_number' => '4000'], ['account_name' => 'Sales', 'root_type' => 'income', 'account_type' => 'sales', 'report_type' => 'profit_and_loss']);

        return [
            'sales_order'     => ['id' => $this->salesOrderId],
            'customer'        => ['id' => $this->customerId],
            'customer_branch' => ['id' => $this->customerBranchId],
            'income_account'  => ['id' => $income->id],
            'debit_account'   => ['id' => $debit->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => now()->toDateString(),
            ...$lists,
        ];
    }

    #[Test]
    public function create_saves_regular_and_asset_rows_with_mutually_exclusive_ids(): void {
        $regularSoItem = $this->makeSalesOrderItem(false);
        $assetSoItem   = $this->makeSalesOrderItem(true);

        $invoice = app(SalesInvoiceService::class)->create($this->payload([
            'items' => [$this->row($regularSoItem, 2), $this->row($assetSoItem, 1)],
        ]))->fresh(['items.asset']);

        $this->assertCount(2, $invoice->items, 'relasi items() mengembalikan semua baris');

        $assetRow   = $invoice->items->firstWhere('sales_order_item_id', $assetSoItem);
        $regularRow = $invoice->items->firstWhere('sales_order_item_id', $regularSoItem);

        $this->assertNull($assetRow->item_id);
        $this->assertNotNull($assetRow->asset_id);
        $this->assertSame($assetRow->asset_id, $assetRow->asset->id);
        $this->assertNotNull($regularRow->item_id);
        $this->assertNull($regularRow->asset_id);
    }

    #[Test]
    public function create_asset_item_row_persists_the_source_asset_id(): void {
        $assetSoItem = $this->makeSalesOrderItem(true);

        $invoice = app(SalesInvoiceService::class)->create($this->payload([
            'items' => [$this->row($assetSoItem, 1)],
        ]))->fresh(['items.asset']);

        $this->assertCount(1, $invoice->items);
        $this->assertSame(
            DB::table('sales_order_items')->where('id', $assetSoItem)->value('asset_id'),
            $invoice->items->first()->asset_id,
        );
        $this->assertNull($invoice->items->first()->item_id);
        $this->assertNull($invoice->items->first()->item_unit_id);
        $this->assertSame(1.0, $invoice->items->first()->conversion_factor);
    }

    #[Test]
    public function create_with_only_regular_rows_behaves_as_before(): void {
        $regularSoItem = $this->makeSalesOrderItem(false);

        $invoice = app(SalesInvoiceService::class)->create($this->payload([
            'items' => [$this->row($regularSoItem, 3)],
        ]))->fresh(['items']);

        $this->assertCount(1, $invoice->items);
        $this->assertEqualsWithDelta(3000, (float) $invoice->amount, 0.01);
    }

    #[Test]
    public function update_switches_the_source_row_and_keeps_item_and_asset_ids_exclusive(): void {
        $assetSource      = $this->makeSalesOrderItem(true);
        $otherAssetSource = $this->makeSalesOrderItem(true);
        $regularSource    = $this->makeSalesOrderItem(false);
        $service          = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'items' => [$this->row($assetSource, 1)],
        ]));
        $rowId = $invoice->items()->first()->id;

        $service->update($invoice->fresh(), $this->payload([
            'items'             => [$this->row($otherAssetSource, 1, ['id' => $rowId])],
            'payment_schedules' => [],
        ]));
        $assetRow = $invoice->items()->first()->fresh();
        $this->assertSame($otherAssetSource, $assetRow->sales_order_item_id);
        $this->assertNull($assetRow->item_id);
        $this->assertSame(
            DB::table('sales_order_items')->where('id', $otherAssetSource)->value('asset_id'),
            $assetRow->asset_id,
        );

        $service->update($invoice->fresh(), $this->payload([
            'items'             => [$this->row($regularSource, 1, ['id' => $rowId])],
            'payment_schedules' => [],
        ]));
        $regularRow = $invoice->items()->first()->fresh();
        $this->assertNotNull($regularRow->item_id);
        $this->assertNull($regularRow->asset_id);
    }

    #[Test]
    public function on_approved_dispatches_once_for_each_asset_row(): void {
        $sourceA  = $this->makeSalesOrderItem(true);
        $sourceB  = $this->makeSalesOrderItem(true);
        $assetIdA = DB::table('sales_order_items')->where('id', $sourceA)->value('asset_id');
        $assetIdB = DB::table('sales_order_items')->where('id', $sourceB)->value('asset_id');
        $service  = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'items'             => [$this->row($sourceA, 1), $this->row($sourceB, 1)],
            'payment_schedules' => [],
        ]));
        $expectedItemIds = $invoice->items()->pluck('id')->all();

        Event::fake();
        $service->onApproved($invoice->fresh());

        Event::assertDispatchedTimes(AssetSoldViaInvoice::class, 2);
        foreach ([$assetIdA, $assetIdB] as $assetId) {
            Event::assertDispatched(
                AssetSoldViaInvoice::class,
                fn (AssetSoldViaInvoice $event) => $event->line instanceof SalesInvoiceItem
                    && in_array($event->line->id, $expectedItemIds, true)
                    && $event->line->asset_id === $assetId,
            );
        }
    }

    // --- baris bebas (spec delivery-note-sales-invoice-off-source-items) ----

    /**
     * @return array<string,mixed>
     */
    private function freeItemRow(float $quantity, float $price): array {
        $item     = Item::factory()->create(['is_fixed_asset' => false, 'is_stock_item' => true]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id, 'is_stock_item' => true]);
        $unitId   = (string) Str::ulid();
        $itemUnit = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitId,
            'code'              => 'PCS-' . $unitId,
            'name'              => 'PCS',
            'conversion_factor' => 1,
            'is_default'        => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
        DB::table('item_units')->insert([
            'id'                => $itemUnit,
            'item_id'           => $item->id,
            'unit_id'           => $unitId,
            'conversion_factor' => 1,
            'is_default'        => true,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return [
            'id'       => (string) Str::ulid(),
            'item'     => ['id' => $variant->id],
            'unit'     => ['id' => $itemUnit],
            'tax'      => ['id' => $this->taxId],
            'quantity' => $quantity,
            'price'    => $price,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function freeAssetRow(Asset $asset, float $price): array {
        return [
            'id'       => (string) Str::ulid(),
            'asset'    => ['id' => $asset->id],
            'tax'      => ['id' => $this->taxId],
            'quantity' => 1,
            'price'    => $price,
        ];
    }

    #[Test]
    public function create_saves_free_rows_without_a_sales_order_item(): void {
        $asset = $this->makeAsset();

        $invoice = app(SalesInvoiceService::class)->create($this->payload([
            'items' => [$this->freeItemRow(2, 1500), $this->freeAssetRow($asset, 9000)],
        ]))->fresh(['items']);

        $itemRow  = $invoice->items->firstWhere('asset_id', null);
        $assetRow = $invoice->items->firstWhere('asset_id', $asset->id);

        $this->assertNull($itemRow->sales_order_item_id);
        $this->assertNotNull($itemRow->item_id);
        $this->assertNotNull($itemRow->item_unit_id);
        $this->assertNull($assetRow->sales_order_item_id);
        $this->assertNull($assetRow->item_id);
        $this->assertNull($assetRow->item_unit_id);
        $this->assertSame(1.0, $assetRow->conversion_factor);
        $this->assertEqualsWithDelta(2 * 1500 + 9000, (float) $invoice->amount, 0.01);
    }

    #[Test]
    public function on_approved_free_rows_do_not_change_sales_order_billing_and_a_free_asset_is_sold(): void {
        $asset   = $this->makeAsset();
        $service = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'items'             => [$this->freeItemRow(2, 1500), $this->freeAssetRow($asset, 9000)],
            'payment_schedules' => [],
        ]));

        Event::fake();
        $service->onApproved($invoice->fresh());

        Event::assertNotDispatched(SalesOrderItemBillingChanged::class);
        Event::assertDispatchedTimes(AssetSoldViaInvoice::class, 1);
        Event::assertDispatched(SalesInvoiceGeneralLedgerPostingRequested::class, fn ($e) => $e->totalAmount === 12000.0);
    }

    #[Test]
    public function create_allows_an_invoice_with_only_free_rows_and_no_sales_order_header(): void {
        $payload = $this->payload(['items' => [$this->freeItemRow(1, 700)]]);
        unset($payload['sales_order']);

        $invoice = app(SalesInvoiceService::class)->create($payload)->fresh();

        $this->assertNull($invoice->sales_order_id);
        $this->assertCount(1, $invoice->items);
    }

    #[Test]
    public function on_approved_rejects_a_free_asset_that_is_no_longer_active(): void {
        $asset   = $this->makeAsset();
        $service = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'items'             => [$this->freeAssetRow($asset, 9000)],
            'payment_schedules' => [],
        ]));
        $asset->forceFill(['status' => [FormStatus::INACTIVE]])->save();

        $this->expectException(\LogicException::class);
        $service->onApproved($invoice->fresh());
    }

    #[Test]
    public function on_approved_so_rows_still_change_sales_order_billing_next_to_free_rows(): void {
        $regularSoItem = $this->makeSalesOrderItem(false);
        $service       = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'items'             => [$this->row($regularSoItem, 2), $this->freeItemRow(1, 500)],
            'payment_schedules' => [],
        ]));

        Event::fake();
        $service->onApproved($invoice->fresh());

        Event::assertDispatchedTimes(SalesOrderItemBillingChanged::class, 1);
    }

    #[Test]
    public function approval_rechecks_strict_invoice_tolerance_after_source_lock(): void {
        $salesOrderItemId = $this->makeSalesOrderItem(false);
        SalesSetting::current()->update(['over_billing_tolerance_percent' => 0]);
        $service = app(SalesInvoiceService::class);
        $invoice = $service->create($this->payload([
            'items'             => [$this->row($salesOrderItemId, 11)],
            'payment_schedules' => [],
        ]));

        $this->expectException(ValidationException::class);
        $service->onApproved($invoice->fresh());
    }

    #[Test]
    public function approval_rechecks_rate_change_stop_after_source_lock(): void {
        $salesOrderItemId = $this->makeSalesOrderItem(false);
        SalesSetting::current()->update(['rate_change_action' => 'stop']);
        $service = app(SalesInvoiceService::class);
        $invoice = $service->create($this->payload([
            'items'             => [$this->row($salesOrderItemId, 1, ['price' => 1010])],
            'payment_schedules' => [],
        ]));

        $this->expectException(ValidationException::class);
        $service->onApproved($invoice->fresh());
    }

    #[Test]
    public function below_cost_stop_rejects_stock_sales_invoice_against_current_warehouse_valuation(): void {
        $invoice = $this->makeBelowCostInvoice('stop');
        $service = app(SalesInvoiceService::class);

        Event::fake();
        $this->expectException(ValidationException::class);
        $service->onApproved($invoice->fresh());
    }

    #[Test]
    public function below_cost_warn_allows_posting_and_flashes_a_warning(): void {
        $invoice = $this->makeBelowCostInvoice('warn');
        $service = app(SalesInvoiceService::class);
        $request = Request::create('/');
        $request->setLaravelSession(app('session')->driver());
        app()->instance('request', $request);
        Event::fake();

        $service->onApproved($invoice->fresh());

        $this->assertNotEmpty($request->session()->get('priceWarnings'));
    }

    #[Test]
    public function below_cost_stop_skips_a_stock_line_without_warehouse_valuation(): void {
        $invoice = $this->makeBelowCostInvoice('stop', false);
        $service = app(SalesInvoiceService::class);
        Event::fake();

        $this->assertNotNull($service->onApproved($invoice->fresh()));
    }

    private function makeBelowCostInvoice(string $action, bool $createStock = true): SalesInvoice {
        $warehouse        = WarehouseFactory::new()->create();
        $salesOrderItemId = $this->makeSalesOrderItem(false, Item::factory()->create(['is_stock_item' => true]));
        $variantId        = DB::table('sales_order_items')->where('id', $salesOrderItemId)->value('item_id');
        $unit             = Unit::query()->create(['code' => 'COST-' . Str::random(6), 'name' => 'Cost unit', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit         = ItemUnit::query()->create(['item_id' => DB::table('item_variants')->where('id', $variantId)->value('item_id'), 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        DB::table('sales_order_items')->where('id', $salesOrderItemId)->update([
            'source_warehouse_id' => $warehouse->id,
            'item_unit_id'        => $itemUnit->id,
            'conversion_factor'   => 1,
        ]);
        if ($createStock) {
            Stock::query()->create([
                'item_variant_id'   => $variantId,
                'warehouse_id'      => $warehouse->id,
                'item_unit_id'      => $itemUnit->id,
                'quantity'          => 10,
                'conversion_factor' => 1,
                'stock_queue'       => [['quantity' => 10, 'rate' => 100]],
            ]);
        }
        SalesSetting::current()->update(['below_cost_action' => $action]);
        $service = app(SalesInvoiceService::class);

        return $service->create($this->payload([
            'items'             => [$this->row($salesOrderItemId, 1, ['price' => 110, 'unit' => ['id' => $itemUnit->id]])],
            'payment_schedules' => [],
            'discount_on'       => 'net_total',
            'discount_rate'     => 18.18,
            'discount_amount'   => 20,
        ]));
    }
}
