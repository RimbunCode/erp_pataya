<?php

namespace Tests\Feature;

use App\Models\Core\FormatingSeries;
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

        DB::table('sales_invoice_items')->insert([
            'id'               => (string) Str::ulid(),
            'sales_invoice_id' => $salesInvoiceId,
            'item_id'          => $itemVariant->id,
            'quantity'         => 10,
            'price'            => $price,
            'tax_rate'         => $taxRate,
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
