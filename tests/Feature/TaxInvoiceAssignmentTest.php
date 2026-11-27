<?php

namespace Tests\Feature;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\User\User;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Finances\TaxInvoiceSerialAllocator;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TaxInvoiceAssignmentTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, SalesInvoice::class, PurchaseInvoice::class] as $model) {
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

    private function seedSerialRange(int $start, int $end): void {
        FinanceSetting::updateOrCreate(['singleton' => true], [
            'tax_invoice_serial_range_start' => $start,
            'tax_invoice_serial_range_end'   => $end,
            'tax_invoice_serial_last_used'   => 0,
        ]);
        DB::table('preferences')->insert([
            ['key' => 'tax_invoice_serial_range_start', 'value' => json_encode($start), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'tax_invoice_serial_range_end', 'value' => json_encode($end), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'tax_invoice_serial_last_used', 'value' => json_encode(0), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function createSalesInvoiceWithItem(float $price, float $taxRate): SalesInvoice {
        $itemVariant = ItemVariantFactory::new()->create();

        $salesInvoiceId = (string) Str::ulid();
        DB::table('sales_invoices')->insert([
            'id'            => $salesInvoiceId,
            'code'          => 'SI-TEST-' . Str::random(8),
            'date'          => now(),
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Sejak Bagian B (Task 9) dpp/pajak item bukan lagi kolom generated: fixture mengisinya dengan formula legacy 11/12.
        $dpp = 10 * $price * 11 / 12;
        DB::table('sales_invoice_items')->insert([
            'id'               => (string) Str::ulid(),
            'sales_invoice_id' => $salesInvoiceId,
            'item_id'          => $itemVariant->id,
            'quantity'         => 10,
            'price'            => $price,
            'tax_rate'         => $taxRate,
            'dpp_amount'       => $dpp,
            'tax_amount'       => $dpp * $taxRate / 100,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return SalesInvoice::findOrFail($salesInvoiceId);
    }

    public function test_serial_number_format_matches_djp_spec(): void {
        $this->seedSerialRange(1, 100);

        $serial = app(TaxInvoiceSerialAllocator::class)->nextSerial('01');

        // Format: 2 digit kode transaksi + 1 digit kode status + 13 digit serial
        $this->assertMatchesRegularExpression('/^01[0-9]\.\d{13}$/', $serial, 'format harus 2 digit kode transaksi + 1 digit status + 13 digit serial');
        $this->assertStringStartsWith('010.', $serial);
    }

    public function test_serial_number_increments_sequentially(): void {
        $this->seedSerialRange(1, 100);
        $allocator = app(TaxInvoiceSerialAllocator::class);

        $first  = $allocator->nextSerial('01');
        $second = $allocator->nextSerial('01');

        $this->assertSame('010.0000000000001', $first);
        $this->assertSame('010.0000000000002', $second);
    }

    public function test_serial_number_rejected_when_range_not_configured(): void {
        $this->expectException(ValidationException::class);

        app(TaxInvoiceSerialAllocator::class)->nextSerial('01');
    }

    public function test_serial_number_rejected_when_range_exhausted(): void {
        $this->seedSerialRange(1, 1);
        $allocator = app(TaxInvoiceSerialAllocator::class);

        $allocator->nextSerial('01');

        $this->expectException(ValidationException::class);
        $allocator->nextSerial('01');
    }

    public function test_serial_range_errors_explain_the_admin_action(): void {
        app()->setLocale('id');
        $allocator = app(TaxInvoiceSerialAllocator::class);
        try {
            $allocator->nextSerial('01');
            $this->fail('Unconfigured range must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString('Hubungi admin', $exception->errors()['tax_invoice_serial_number'][0]);
        }

        $this->seedSerialRange(1, 1);
        $allocator->nextSerial('01');
        try {
            $allocator->nextSerial('01');
            $this->fail('Exhausted range must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString('Hubungi admin', $exception->errors()['tax_invoice_serial_number'][0]);
        }
    }

    public function test_assign_tax_invoice_persists_dpp_ppn_breakdown_from_items(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $salesInvoice->load('items');

        $expectedDpp = $salesInvoice->items->sum('dpp_amount');
        $expectedPpn = $salesInvoice->items->sum('tax_amount');

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($salesInvoice, '04');

        $this->assertNotNull($result->tax_invoice_serial_number);
        $this->assertSame('04', $result->tax_invoice_transaction_code);
        $this->assertEqualsWithDelta($expectedDpp, $result->tax_invoice_dpp_amount, 0.01, 'DPP header harus sama dengan sum item dpp_amount');
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01, 'PPN header harus sama dengan sum item tax_amount');
        $this->assertEqualsWithDelta(0, $result->tax_invoice_ppnbm_amount, 0.01, 'PPnBM belum didukung (Requirement 4 skip), harus tetap 0');

        // Bukti persisted, bukan cuma di memory
        $reloaded = $result->fresh();
        $this->assertEqualsWithDelta($expectedDpp, $reloaded->tax_invoice_dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedPpn, $reloaded->tax_invoice_ppn_amount, 0.01);
    }

    /**
     * @param  list<array{category: string, dpp: mixed, tax: mixed, rule_version_id?: string|null}>  $components
     */
    private function setBreakdown(string $table, string $id, array $components): void {
        DB::table($table)->where('id', $id)->update(['tax_breakdown' => json_encode([
            'minor_unit' => 2,
            'components' => array_map(fn (array $c): array => [
                'tax_id'          => (string) Str::ulid(),
                'category'        => $c['category'],
                'behavior'        => 'additive',
                'dpp_amount'      => $c['dpp'],
                'tax_amount'      => $c['tax'],
                'rule_version_id' => $c['rule_version_id'] ?? null,
            ], $components),
        ])]);
    }

    public function test_assign_tax_invoice_sums_only_ppn_components_when_breakdown_is_classified(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, [
            ['category' => 'ppn_standard', 'dpp' => '11000.00', 'tax' => '1320.00'],
            ['category' => 'ppn_luxury', 'dpp' => '2000.00', 'tax' => '400.00'],
            ['category' => 'other', 'dpp' => '12000.00', 'tax' => '999.00'],
            ['category' => 'pph_23', 'dpp' => '12000.00', 'tax' => '240.00'],
        ]);

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($salesInvoice->fresh(), '04');

        $this->assertEqualsWithDelta(13000.00, $result->fresh()->tax_invoice_dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1720.00, $result->fresh()->tax_invoice_ppn_amount, 0.001);
        $this->assertSame('040.0000000000001', $result->tax_invoice_serial_number, 'nomor seri tidak berubah');
    }

    public function test_assign_tax_invoice_with_classified_breakdown_without_ppn_yields_zero(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, [
            ['category' => 'pph_23', 'dpp' => '12000.00', 'tax' => '240.00'],
        ]);

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($salesInvoice->fresh(), '04')->fresh();

        $this->assertEqualsWithDelta(0, $result->tax_invoice_dpp_amount, 0.001);
        $this->assertEqualsWithDelta(0, $result->tax_invoice_ppn_amount, 0.001);
    }

    public function test_assign_tax_invoice_keeps_legacy_sum_when_breakdown_has_unclassified_component(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, [
            ['category' => 'ppn_standard', 'dpp' => '1.00', 'tax' => '1.00'],
            ['category' => 'unclassified', 'dpp' => '2.00', 'tax' => '2.00'],
        ]);
        $fresh       = $salesInvoice->fresh()->load('items');
        $expectedDpp = $fresh->items->sum('dpp_amount');
        $expectedPpn = $fresh->items->sum('tax_amount');

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($fresh, '04')->fresh();

        $this->assertEqualsWithDelta($expectedDpp, $result->tax_invoice_dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01);
    }

    public function test_assign_tax_invoice_keeps_legacy_sum_when_snapshot_failed_to_build(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, []);
        $fresh       = $salesInvoice->fresh()->load('items');
        $expectedPpn = $fresh->items->sum('tax_amount');

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($fresh, '04')->fresh();

        $this->assertGreaterThan(0, $expectedPpn);
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01);
    }

    private function createPurchaseInvoiceWithItem(): PurchaseInvoice {
        $itemVariant       = ItemVariantFactory::new()->create();
        $purchaseInvoiceId = (string) Str::ulid();
        DB::table('purchase_invoices')->insert([
            'id'            => $purchaseInvoiceId, 'code' => 'PI-TEST-' . Str::random(8), 'date' => now(),
            'created_by_id' => Auth::id(), 'amount' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('purchase_invoice_items')->insert([
            'id'       => (string) Str::ulid(), 'purchase_invoice_id' => $purchaseInvoiceId, 'item_id' => $itemVariant->id,
            'quantity' => 4, 'rate' => 3000, 'tax_rate' => 11, 'created_at' => now(), 'updated_at' => now(),
            // Sejak Bagian B (Task 9) dpp/pajak/jumlah item bukan lagi kolom generated: fixture memakai formula legacy 11/12.
            'dpp_amount' => 4 * 3000 * 11 / 12, 'tax_amount' => 4 * 3000 * 11 / 12 * 11 / 100, 'amount' => 4 * 3000 + 4 * 3000 * 11 / 12 * 11 / 100,
        ]);

        return PurchaseInvoice::findOrFail($purchaseInvoiceId);
    }

    public function test_record_purchase_tax_invoice_keeps_legacy_sum_when_breakdown_has_unclassified_component(): void {
        $purchaseInvoice = $this->createPurchaseInvoiceWithItem();
        $this->setBreakdown('purchase_invoices', $purchaseInvoice->id, [
            ['category' => 'ppn_standard', 'dpp' => '1.00', 'tax' => '1.00'],
            ['category' => 'unclassified', 'dpp' => '2.00', 'tax' => '2.00'],
        ]);
        $fresh       = $purchaseInvoice->fresh()->load('items');
        $expectedDpp = $fresh->items->sum('dpp_amount');
        $expectedPpn = $fresh->items->sum('tax_amount');

        $result = app(PurchaseInvoiceService::class)->recordTaxInvoice($fresh, '01', '010.000-26.00000125', now())->fresh();

        $this->assertGreaterThan(0, $expectedPpn);
        $this->assertEqualsWithDelta($expectedDpp, $result->tax_invoice_dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01);
    }

    public function test_record_purchase_tax_invoice_keeps_legacy_sum_when_snapshot_components_are_empty(): void {
        $purchaseInvoice = $this->createPurchaseInvoiceWithItem();
        $this->setBreakdown('purchase_invoices', $purchaseInvoice->id, []);
        $fresh       = $purchaseInvoice->fresh()->load('items');
        $expectedDpp = $fresh->items->sum('dpp_amount');
        $expectedPpn = $fresh->items->sum('tax_amount');

        $result = app(PurchaseInvoiceService::class)->recordTaxInvoice($fresh, '01', '010.000-26.00000126', now())->fresh();

        $this->assertGreaterThan(0, $expectedPpn);
        $this->assertEqualsWithDelta($expectedDpp, $result->tax_invoice_dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01);
    }

    public function test_assign_tax_invoice_treats_legacy_component_with_classified_category_by_its_category(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, [
            // Legacy: tanpa versi aturan, kategori PPN terklasifikasi -> ikut dijumlahkan (Requirement 9.4).
            ['category' => 'ppn_standard', 'dpp' => '5000.00', 'tax' => '550.00', 'rule_version_id' => null],
            ['category' => 'ppn_standard', 'dpp' => '6000.00', 'tax' => '660.00', 'rule_version_id' => (string) Str::ulid()],
            // Legacy non-PPN terklasifikasi -> tidak dijumlahkan.
            ['category' => 'pph_23', 'dpp' => '12000.00', 'tax' => '240.00', 'rule_version_id' => null],
        ]);

        $result = app(SalesInvoiceService::class)->assignTaxInvoice($salesInvoice->fresh(), '04')->fresh();

        $this->assertEqualsWithDelta(11000.00, $result->tax_invoice_dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1210.00, $result->tax_invoice_ppn_amount, 0.001);
    }

    public function test_assign_tax_invoice_with_malformed_breakdown_throws_before_serial_is_allocated(): void {
        $this->seedSerialRange(1, 100);
        $salesInvoice = $this->createSalesInvoiceWithItem(price: 1200, taxRate: 11);
        $this->setBreakdown('sales_invoices', $salesInvoice->id, [
            ['category' => 'ppn_standard', 'dpp' => 'bukan-angka', 'tax' => '1.00'],
        ]);

        try {
            app(SalesInvoiceService::class)->assignTaxInvoice($salesInvoice->fresh(), '04');
            $this->fail('Breakdown rusak harus melempar exception.');
        } catch (\Throwable $e) {
            $this->assertNotInstanceOf(ValidationException::class, $e);
        }

        $this->assertSame(0, (int) FinanceSetting::query()->value('tax_invoice_serial_last_used'), 'nomor seri tidak boleh terpakai');
        $this->assertNull($salesInvoice->fresh()->tax_invoice_serial_number);
        $this->assertSame('040.0000000000001', app(TaxInvoiceSerialAllocator::class)->nextSerial('04'));
    }

    public function test_record_purchase_tax_invoice_sums_only_ppn_components_when_breakdown_is_classified(): void {
        $itemVariant       = ItemVariantFactory::new()->create();
        $purchaseInvoiceId = (string) Str::ulid();
        DB::table('purchase_invoices')->insert([
            'id'            => $purchaseInvoiceId, 'code' => 'PI-TEST-' . Str::random(8), 'date' => now(),
            'created_by_id' => Auth::id(), 'amount' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('purchase_invoice_items')->insert([
            'id'       => (string) Str::ulid(), 'purchase_invoice_id' => $purchaseInvoiceId, 'item_id' => $itemVariant->id,
            'quantity' => 4, 'rate' => 3000, 'tax_rate' => 11, 'created_at' => now(), 'updated_at' => now(),
            // Sejak Bagian B (Task 9) dpp/pajak/jumlah item bukan lagi kolom generated: fixture memakai formula legacy 11/12.
            'dpp_amount' => 4 * 3000 * 11 / 12, 'tax_amount' => 4 * 3000 * 11 / 12 * 11 / 100, 'amount' => 4 * 3000 + 4 * 3000 * 11 / 12 * 11 / 100,
        ]);
        $this->setBreakdown('purchase_invoices', $purchaseInvoiceId, [
            ['category' => 'ppn_standard', 'dpp' => '11000.00', 'tax' => '1320.00'],
            ['category' => 'pph_23', 'dpp' => '12000.00', 'tax' => '240.00'],
        ]);

        $result = app(PurchaseInvoiceService::class)->recordTaxInvoice(
            PurchaseInvoice::findOrFail($purchaseInvoiceId),
            '01',
            '010.000-26.00000124',
            now(),
        )->fresh();

        $this->assertSame('010.000-26.00000124', $result->tax_invoice_serial_number);
        $this->assertEqualsWithDelta(11000.00, $result->tax_invoice_dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1320.00, $result->tax_invoice_ppn_amount, 0.001);
    }

    public function test_record_purchase_tax_invoice_stores_supplier_issued_serial_verbatim(): void {
        $itemVariant       = ItemVariantFactory::new()->create();
        $purchaseInvoiceId = (string) Str::ulid();
        DB::table('purchase_invoices')->insert([
            'id'            => $purchaseInvoiceId,
            'code'          => 'PI-TEST-' . Str::random(8),
            'date'          => now(),
            'created_by_id' => Auth::id(),
            'amount'        => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        DB::table('purchase_invoice_items')->insert([
            'id'                  => (string) Str::ulid(),
            'purchase_invoice_id' => $purchaseInvoiceId,
            'item_id'             => $itemVariant->id,
            'quantity'            => 4,
            'rate'                => 3000,
            'tax_rate'            => 11,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);
        $purchaseInvoice = PurchaseInvoice::findOrFail($purchaseInvoiceId);
        $purchaseInvoice->load('items');

        $expectedDpp    = $purchaseInvoice->items->sum('dpp_amount');
        $expectedPpn    = $purchaseInvoice->items->sum('tax_amount');
        $supplierSerial = '010.000-26.00000123';

        $result = app(PurchaseInvoiceService::class)->recordTaxInvoice(
            $purchaseInvoice,
            '01',
            $supplierSerial,
            now(),
        );

        // Nomor seri Faktur Pajak Masukan harus tersimpan PERSIS seperti yang
        // diterbitkan supplier -- tidak boleh di-generate ulang oleh allocator.
        $this->assertSame($supplierSerial, $result->tax_invoice_serial_number);
        $this->assertEqualsWithDelta($expectedDpp, $result->tax_invoice_dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedPpn, $result->tax_invoice_ppn_amount, 0.01);
    }
}
