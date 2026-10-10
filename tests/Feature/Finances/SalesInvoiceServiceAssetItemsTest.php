<?php

namespace Tests\Feature\Finances;

use App\Events\Asset\AssetSoldViaInvoice;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Finances\SalesInvoiceService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * SalesInvoiceService menggabungkan bucket dan menyimpan asset_id langsung
 * pada SalesInvoiceItem tanpa child table.
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

        return Asset::factory()->rentable()->create(['asset_category_id' => $category->id, 'item_id' => $this->assetItem->id]);
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
            'items'       => [$this->row($regularSoItem, 2)],
            'asset_items' => [$this->row($assetSoItem, 1)],
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
            'asset_items' => [$this->row($assetSoItem, 1)],
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
    public function create_without_asset_items_behaves_as_before(): void {
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
            'asset_items' => [$this->row($assetSource, 1)],
        ]));
        $rowId = $invoice->items()->first()->id;

        $service->update($invoice->fresh(), $this->payload([
            'asset_items'       => [$this->row($otherAssetSource, 1, ['id' => $rowId])],
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
            'asset_items'       => [],
            'payment_schedules' => [],
        ]));
        $regularRow = $invoice->items()->first()->fresh();
        $this->assertNotNull($regularRow->item_id);
        $this->assertNull($regularRow->asset_id);
    }

    #[Test]
    public function on_approved_dispatches_once_for_each_asset_item_row(): void {
        $sourceA  = $this->makeSalesOrderItem(true);
        $sourceB  = $this->makeSalesOrderItem(true);
        $assetIdA = DB::table('sales_order_items')->where('id', $sourceA)->value('asset_id');
        $assetIdB = DB::table('sales_order_items')->where('id', $sourceB)->value('asset_id');
        $service  = app(SalesInvoiceService::class);

        $invoice = $service->create($this->payload([
            'asset_items'       => [$this->row($sourceA, 1), $this->row($sourceB, 1)],
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
}
