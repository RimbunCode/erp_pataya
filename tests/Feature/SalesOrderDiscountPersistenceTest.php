<?php

namespace Tests\Feature;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use App\Services\Sales\SalesOrderService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Finances\TaxFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class SalesOrderDiscountPersistenceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Pola sama dengan PurchaseOrderDiscountPersistenceTest -- initPermissions() men-seed
        // kolom runtime (code, status, dst) dan FormatingSeries yang dibutuhkan generate kode dokumen.
        foreach ([User::class, FormatingSeries::class, SalesOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Auth::login(User::factory()->create());
    }

    /**
     * @return array{item_id: string, unit_id: string}
     */
    private function createItemWithUnit(): array {
        $itemVariant = ItemVariantFactory::new()->create();

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'         => $itemUnitId,
            'item_id'    => $itemVariant->item_id,
            'unit_id'    => $itemVariant->default_unit_id,
            'is_default' => true,
            'order'      => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['item_id' => $itemVariant->id, 'unit_id' => $itemUnitId];
    }

    /**
     * Fixture baku dari requirements.md Part 5: line 1 = 10x100.000 @ PPN 11%,
     * line 2 = 5x200.000 @ 10%.
     */
    private function buildPayload(?string $discountOn = null, float $discountRate = 0, float $discountAmount = 0): array {
        $country        = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer       = CustomerFactory::new()->create(['country_id' => $country->code]);
        $customerBranch = Branch::where('branchable_type', Customer::class)
            ->where('branchable_id', $customer->id)
            ->where('is_main_branch', true)
            ->firstOrFail();
        $warehouse = WarehouseFactory::new()->create();

        $line1    = $this->createItemWithUnit();
        $line2    = $this->createItemWithUnit();
        $taxPpn11 = TaxFactory::new()->create(['rate' => 11]);
        $taxPph10 = TaxFactory::new()->create(['rate' => 10]);

        return [
            'customer'          => ['id' => $customer->id],
            'customer_branch'   => ['id' => $customerBranch->id],
            'branch'            => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'              => now()->toDateString(),
            'discount_on'       => $discountOn,
            'discount_rate'     => $discountRate,
            'discount_amount'   => $discountAmount,
            'payment_schedules' => [],
            'items'             => [
                [
                    'id'               => (string) Str::ulid(),
                    'item'             => ['id' => $line1['item_id']],
                    'unit'             => ['id' => $line1['unit_id']],
                    'source_warehouse' => ['id' => $warehouse->id],
                    'tax'              => ['id' => $taxPpn11->id],
                    'quantity'         => 10,
                    'price'            => 100000,
                ],
                [
                    'id'               => (string) Str::ulid(),
                    'item'             => ['id' => $line2['item_id']],
                    'unit'             => ['id' => $line2['unit_id']],
                    'source_warehouse' => ['id' => $warehouse->id],
                    'tax'              => ['id' => $taxPph10->id],
                    'quantity'         => 5,
                    'price'            => 200000,
                ],
            ],
        ];
    }

    public function test_case_a_create_without_discount(): void {
        $salesOrder = app(SalesOrderService::class)->create($this->buildPayload());

        $this->assertEqualsWithDelta(2000000, $salesOrder->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(210000, $salesOrder->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(2210000, $salesOrder->fresh()->amount, 0.01);
    }

    public function test_case_b_create_with_ten_percent_discount_on_net_total(): void {
        $salesOrder = app(SalesOrderService::class)->create(
            $this->buildPayload('net_total', 10, 200000),
        );

        $salesOrder->refresh();
        $salesOrder->load('items');

        $this->assertEqualsWithDelta(1800000, $salesOrder->items->sum('basic_amount'), 0.01, 'DPP header harus turun setelah diskon, bukan beku');
        $this->assertEqualsWithDelta(189000, $salesOrder->items->sum('tax_amount'), 0.01, 'Pajak harus dihitung ulang dari basic_amount yang sudah dipotong diskon');
        $this->assertEqualsWithDelta(1989000, $salesOrder->amount, 0.01);

        $reloaded = $salesOrder->fresh(['items']);
        $this->assertEqualsWithDelta(1800000, $reloaded->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(189000, $reloaded->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(1989000, $reloaded->amount, 0.01);
    }

    public function test_case_c_create_with_ten_percent_discount_on_grand_total(): void {
        $salesOrder = app(SalesOrderService::class)->create(
            $this->buildPayload('grand_total', 10, 221000),
        );

        $salesOrder->refresh();
        $salesOrder->load('items');

        $this->assertEqualsWithDelta(1800000, $salesOrder->items->sum('basic_amount'), 0.01);
        $this->assertEqualsWithDelta(189000, $salesOrder->items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(1989000, $salesOrder->amount, 0.01);
    }

    public function test_update_recalculates_discount_after_items_change(): void {
        $service = app(SalesOrderService::class);
        $created = $service->create($this->buildPayload('net_total', 10, 200000));
        // Re-fetch -- lihat catatan yang sama di PurchaseOrderDiscountPersistenceTest soal
        // DataTable::logForCreated() meninggalkan $this->dataAfter dirty tanpa property
        // terdeklarasi, menyebabkan save() berikutnya pada instance yang sama gagal.
        $salesOrder = $created->fresh(['items']);

        $payload                         = $this->buildPayload('net_total', 10, 200000);
        $payload['items'][0]['id']       = $salesOrder->items[0]->id;
        $payload['items'][1]['id']       = $salesOrder->items[1]->id;
        $payload['items'][0]['quantity'] = 20;
        $payload['discount_amount']      = 300000;

        $updated = $service->update($salesOrder, $payload);
        $updated->load('items');

        $newSumBasic = $updated->items->sum('basic_amount');
        $newSumTax   = $updated->items->sum('tax_amount');

        $this->assertEqualsWithDelta($newSumBasic + $newSumTax, $updated->amount, 0.01, 'Total == DPP + Tax harus tetap benar setelah update dengan item berubah');
        $this->assertEqualsWithDelta($newSumBasic, $updated->fresh(['items'])->items->sum('basic_amount'), 0.01, 'nilai persisted harus sama dengan yang di-load ulang');
    }
}
