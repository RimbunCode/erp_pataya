<?php

namespace Tests\Feature\Finances\Tax;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Finances\Tax\DocumentTaxSnapshot;
use App\Services\Finances\Tax\TaxEngine;
use App\Services\Finances\Tax\TaxResult;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 5.4: snapshot versi aturan pada invoice (Requirement 5). Angka dokumen tidak berubah (P-2),
 * versi di-resolve pada tanggal dokumen (3.4), pajak tanpa versi gagal tertutup tanpa meninggalkan dokumen setengah
 * jadi (Q-P3-5), invoice legacy tetap valid (5.5), dan `tax_breakdown` hanya ditulis saat approve dan tak berubah
 * sesudahnya (5.3).
 */
class InvoiceTaxSnapshotTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $income;
    private Account $expense;
    private Account $payable;
    private TaxRuleVersionService $versions;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, SalesOrder::class, PurchaseInvoice::class, PurchaseOrder::class]);

        // Supplier memakai nested set; `initPermissions()` tidak dipanggil untuknya (indeks `lft_index` bentrok dengan
        // Account), jadi kolomnya ditambahkan langsung seperti PurchaseInvoiceDiscountPersistenceTest.
        if (! Schema::hasColumn('suppliers', 'lft')) {
            Schema::table('suppliers', function ($table): void {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }

        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->income     = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->expense    = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->payable    = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->versions   = app(TaxRuleVersionService::class);

        // Fase 2: akun dokumen ditentukan engine posting; tanpa Posting Profile aktif, `onApproved()` gagal.
        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil tes snapshot pajak', '2020-01-01', null, [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->income->id,
            'payable'    => $this->payable->id,
            'expense'    => $this->expense->id,
        ], []));
    }

    /**
     * Pajak dengan satu versi aktif sejak `$from` (tanpa batas akhir).
     */
    private function taxWithVersion(string $name = 'PPN', float $rate = 11, string $from = '2026-01-01'): Tax {
        $tax = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => Tax::CATEGORY_PPN_STANDARD]);
        $this->versions->activate($this->versions->createDraft($tax, [
            'effective_from'  => $from,
            'rate'            => $rate,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
        ]));

        return $tax;
    }

    private function activeVersionOf(Tax $tax): TaxRuleVersion {
        return TaxRuleVersion::query()->where('tax_id', $tax->getKey())->where('status', TaxRuleVersion::STATUS_ACTIVE)->orderBy('version')->firstOrFail();
    }

    /**
     * Pajak 11% sampai 2026-06-30 dan 12% sejak 2026-07-01 (dua versi, tanpa mengubah kode).
     *
     * @return array{tax: Tax, v1: TaxRuleVersion, v2: TaxRuleVersion}
     */
    private function taxWithRateChange(): array {
        $tax = $this->taxWithVersion('PPN bertahap', 11, '2026-01-01');
        $v1  = $this->activeVersionOf($tax);
        $v2  = $this->versions->activate($this->versions->createNewVersion($v1, '2026-07-01', null, ['rate' => 12]));

        return ['tax' => $tax, 'v1' => $v1->fresh(), 'v2' => $v2];
    }

    /**
     * @param  list<string|null>  $taxIds  satu item bebas (tanpa baris SO) per pajak; null = item tanpa pajak
     * @param  array<string, mixed>  $extra  atribut header tambahan (mis. `return_against`)
     * @param  array<string, mixed>  $itemExtra  atribut tambahan pada setiap item (mis. `return_against_item_id`)
     */
    private function createSalesInvoice(array $taxIds, string $date, array $extra = [], array $itemExtra = []): SalesInvoice {
        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        $items = [];
        foreach ($taxIds as $taxId) {
            $items[] = [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $taxId],
                'quantity' => 10,
                'price'    => 100000,
                ...$itemExtra,
            ];
        }

        return app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'income_account'  => ['id' => $this->income->id],
            'debit_account'   => ['id' => $this->receivable->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => $date,
            'items'           => $items,
            ...$extra,
        ]);
    }

    /**
     * @param  list<string|null>  $taxIds
     * @param  array<string, mixed>  $extra  atribut header tambahan (mis. `return_against`)
     * @param  array<string, mixed>  $itemExtra  atribut tambahan pada setiap item (mis. `return_against_item_id`)
     */
    private function createPurchaseInvoice(array $taxIds, string $date, array $extra = [], array $itemExtra = []): PurchaseInvoice {
        $country  = CountryFactory::new()->create();
        $supplier = Supplier::query()->create(['name' => 'PT Pemasok', 'is_disabled' => false, 'country_id' => $country->code]);
        $order    = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-SNAP-' . Str::random(6),
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));

        $items = [];
        foreach ($taxIds as $taxId) {
            $items[] = [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $taxId],
                'quantity' => 10,
                'rate'     => 100000,
                ...$itemExtra,
            ];
        }

        return app(PurchaseInvoiceService::class)->create([
            'purchase_order'       => ['id' => $order->id],
            'supplier'             => ['id' => $supplier->id],
            'branch'               => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'                 => $date,
            'expense_head_account' => ['id' => $this->expense->id],
            'credit_account'       => ['id' => $this->payable->id],
            'items'                => $items,
            ...$extra,
        ]);
    }

    public function test_sales_items_get_the_version_effective_on_the_document_date(): void {
        ['tax' => $tax, 'v1' => $v1, 'v2' => $v2] = $this->taxWithRateChange();

        $before = $this->createSalesInvoice([$tax->getKey()], '2026-06-30')->items()->firstOrFail();
        $after  = $this->createSalesInvoice([$tax->getKey()], '2026-07-01')->items()->firstOrFail();

        $this->assertSame($v1->getKey(), $before->tax_rule_version_id, 'Hari terakhir versi 1.');
        $this->assertEquals(11.0, $before->tax_rate);
        $this->assertSame($v2->getKey(), $after->tax_rule_version_id, 'Hari pertama versi 2.');
        $this->assertEquals(12.0, $after->tax_rate);
    }

    public function test_sales_document_numbers_equal_the_legacy_formula(): void {
        // P-2: Bagian A tidak mengubah angka dokumen; kolom hitung item tetap sumber kebenaran.
        $tax  = $this->taxWithVersion('PPN 11', 11);
        $item = $this->createSalesInvoice([$tax->getKey()], '2026-03-01')->items()->firstOrFail()->refresh();

        $this->assertEqualsWithDelta(1_000_000, $item->basic_amount, 0.001);
        $this->assertEqualsWithDelta(1_000_000 * 11 / 12, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1_000_000 * 11 / 12 * 11 / 100, $item->tax_amount, 0.001);
    }

    public function test_sales_item_without_tax_has_no_version_and_zero_rate(): void {
        $item = $this->createSalesInvoice([null], '2026-03-01')->items()->firstOrFail();

        $this->assertNull($item->tax_id);
        $this->assertNull($item->tax_rule_version_id);
        $this->assertEquals(0.0, $item->tax_rate);
    }

    public function test_sales_update_resolves_again_for_the_new_document_date(): void {
        ['tax' => $tax, 'v1' => $v1, 'v2' => $v2] = $this->taxWithRateChange();
        $invoice                                  = $this->createSalesInvoice([$tax->getKey()], '2026-06-30');
        $item                                     = $invoice->items()->firstOrFail();
        $this->assertSame($v1->getKey(), $item->tax_rule_version_id);

        app(SalesInvoiceService::class)->update($invoice, [
            'customer'          => ['id' => $invoice->customer_id],
            'customer_branch'   => ['id' => $invoice->customer_branch_id],
            'income_account'    => ['id' => $this->income->id],
            'debit_account'     => ['id' => $this->receivable->id],
            'date'              => '2026-07-01',
            'payment_schedules' => [],
            'items'             => [[
                'id'       => $item->id,
                'item'     => ['id' => $item->item_id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $tax->getKey()],
                'quantity' => 10,
                'price'    => 100000,
            ]],
        ]);

        $item->refresh();
        $this->assertSame($v2->getKey(), $item->tax_rule_version_id);
        $this->assertEquals(12.0, $item->tax_rate);
    }

    public function test_sales_tax_without_any_version_fails_closed_and_leaves_nothing_behind(): void {
        // Q-P3-5: selalu gagal tertutup, termasuk pajak yang belum pernah dibackfill.
        $unversioned = Tax::query()->create(['name' => 'Pajak baru', 'rate' => 11]);

        try {
            $this->createSalesInvoice([$unversioned->getKey()], '2026-03-01');
            $this->fail('Pajak tanpa versi harus menggagalkan pembuatan invoice.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.tax', $e->errors());
            $this->assertStringContainsString('Pajak baru', $e->errors()['items.0.tax'][0]);
        }

        $this->assertSame(0, SalesInvoice::query()->count(), 'Tidak boleh ada header yatim.');
    }

    public function test_sales_date_outside_every_version_fails_closed(): void {
        $tax = $this->taxWithVersion('PPN', 11, '2026-01-01');

        $this->expectException(ValidationException::class);
        $this->createSalesInvoice([$tax->getKey()], '2025-06-01');
    }

    public function test_the_failing_line_is_named_in_the_error(): void {
        $good        = $this->taxWithVersion('PPN baik', 11);
        $unversioned = Tax::query()->create(['name' => 'Tanpa versi', 'rate' => 5]);

        try {
            $this->createSalesInvoice([$good->getKey(), $unversioned->getKey()], '2026-03-01');
            $this->fail('Harus gagal.');
        } catch (ValidationException $e) {
            $this->assertSame(['items.1.tax'], array_keys($e->errors()));
        }
    }

    public function test_request_cannot_forge_the_version_or_the_breakdown(): void {
        $tax   = $this->taxWithVersion('PPN', 11);
        $other = $this->taxWithVersion('PPN lain', 5);

        $invoice = $this->createSalesInvoice([$tax->getKey()], '2026-03-01', ['tax_breakdown' => ['forged' => true]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertNull($invoice->fresh()->tax_breakdown, 'tax_breakdown hanya ditulis saat approve.');
        $this->assertSame($this->activeVersionOf($tax)->getKey(), $item->tax_rule_version_id);
        $this->assertNotSame($this->activeVersionOf($other)->getKey(), $item->tax_rule_version_id);
    }

    public function test_forged_version_in_the_item_payload_is_overwritten(): void {
        $tax   = $this->taxWithVersion('PPN', 11);
        $other = $this->taxWithVersion('PPN lain', 5);

        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        $invoice = app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'income_account'  => ['id' => $this->income->id],
            'debit_account'   => ['id' => $this->receivable->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => '2026-03-01',
            'items'           => [[
                'id'                  => (string) Str::ulid(),
                'item'                => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'                => ['id' => null],
                'tax'                 => ['id' => $tax->getKey()],
                'quantity'            => 1,
                'price'               => 1000,
                'tax_rule_version_id' => $this->activeVersionOf($other)->getKey(),
                'tax_rate'            => 99,
            ]],
        ]);

        $item = $invoice->items()->firstOrFail();
        $this->assertSame($this->activeVersionOf($tax)->getKey(), $item->tax_rule_version_id);
        $this->assertEquals(11.0, $item->tax_rate);
    }

    public function test_sales_return_items_resolve_the_version_on_the_return_date(): void {
        // Task 5.2: jalur retur memakai pintu yang sama. Versi mengikuti tanggal retur, bukan tanggal faktur asal
        // (Requirement 5.2 apa adanya); lihat catatan keputusan terbuka di laporan.
        ['tax' => $tax, 'v1' => $v1, 'v2' => $v2] = $this->taxWithRateChange();
        $original                                 = $this->createSalesInvoice([$tax->getKey()], '2026-06-30');
        $originalItem                             = $original->items()->firstOrFail();

        $return = $this->createSalesInvoice(
            [$tax->getKey()],
            '2026-07-01',
            ['return_against' => ['id' => $original->id]],
            ['return_against_item_id' => $originalItem->id, 'quantity' => 1],
        );
        $returnItem = $return->items()->firstOrFail();

        $this->assertSame($original->id, $return->return_against_id);
        $this->assertSame($v1->getKey(), $originalItem->fresh()->tax_rule_version_id, 'Faktur asal tidak berubah.');
        $this->assertSame($v2->getKey(), $returnItem->tax_rule_version_id);
        $this->assertEquals(12.0, $returnItem->tax_rate);
    }

    public function test_purchase_return_items_resolve_the_version_on_the_return_date(): void {
        ['tax' => $tax, 'v1' => $v1, 'v2' => $v2] = $this->taxWithRateChange();
        $original                                 = $this->createPurchaseInvoice([$tax->getKey()], '2026-06-30');
        $originalItem                             = $original->items()->firstOrFail();

        $return = $this->createPurchaseInvoice(
            [$tax->getKey()],
            '2026-07-01',
            ['return_against' => ['id' => $original->id]],
            ['return_against_item_id' => $originalItem->id, 'quantity' => 1],
        );
        $returnItem = $return->items()->firstOrFail();

        $this->assertSame($original->id, $return->return_against_id);
        $this->assertSame($v1->getKey(), $originalItem->fresh()->tax_rule_version_id);
        $this->assertSame($v2->getKey(), $returnItem->tax_rule_version_id);
        $this->assertEquals(12.0, $returnItem->tax_rate);
    }

    public function test_purchase_items_get_the_version_effective_on_the_document_date(): void {
        ['tax' => $tax, 'v1' => $v1, 'v2' => $v2] = $this->taxWithRateChange();

        $before = $this->createPurchaseInvoice([$tax->getKey()], '2026-06-30')->items()->firstOrFail();
        $after  = $this->createPurchaseInvoice([$tax->getKey()], '2026-07-01')->items()->firstOrFail();

        $this->assertSame($v1->getKey(), $before->tax_rule_version_id);
        $this->assertEquals(11.0, $before->tax_rate);
        $this->assertSame($v2->getKey(), $after->tax_rule_version_id);
        $this->assertEquals(12.0, $after->tax_rate);
    }

    public function test_purchase_document_numbers_equal_the_legacy_formula(): void {
        $tax  = $this->taxWithVersion('PPN 11', 11);
        $item = $this->createPurchaseInvoice([$tax->getKey()], '2026-03-01')->items()->firstOrFail()->refresh();

        $this->assertEqualsWithDelta(1_000_000, $item->basic_amount, 0.001);
        $this->assertEqualsWithDelta(1_000_000 * 11 / 12, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1_000_000 * 11 / 12 * 11 / 100, $item->tax_amount, 0.001);
    }

    public function test_purchase_tax_without_any_version_fails_closed_and_leaves_nothing_behind(): void {
        $unversioned = Tax::query()->create(['name' => 'Pajak baru', 'rate' => 11]);

        try {
            $this->createPurchaseInvoice([$unversioned->getKey()], '2026-03-01');
            $this->fail('Pajak tanpa versi harus menggagalkan pembuatan invoice.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.tax', $e->errors());
        }

        $this->assertSame(0, PurchaseInvoice::query()->count());
    }

    /**
     * @param  array<string, mixed>  $itemAttributes
     */
    private function approvableSalesInvoice(array $itemAttributes): SalesInvoice {
        return $this->makeSalesInvoice($this->receivable, $this->income, [], $itemAttributes);
    }

    private function approveSales(SalesInvoice $invoice): SalesInvoice {
        app(SalesInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh(['items']);
    }

    public function test_approving_stores_the_breakdown_without_changing_document_numbers(): void {
        $tax     = $this->taxWithVersion('PPN 10', 10);
        $version = $this->activeVersionOf($tax);
        $invoice = $this->approvableSalesInvoice(['tax_id' => $tax->getKey(), 'tax_rule_version_id' => $version->getKey()]);
        $before  = $invoice->items()->firstOrFail()->only(['basic_amount', 'discount_amount', 'dpp_amount', 'tax_amount', 'tax_rate']);

        $approved = $this->approveSales($invoice);

        $this->assertSame($before, $approved->items->first()->only(['basic_amount', 'discount_amount', 'dpp_amount', 'tax_amount', 'tax_rate']), 'P-2: angka item tidak berubah.');
        $this->assertEqualsWithDelta(2183.33, $approved->amount, 0.01);

        $breakdown = $approved->tax_breakdown;
        $this->assertIsArray($breakdown);
        $this->assertCount(1, $breakdown['components']);
        $component = $breakdown['components'][0];
        $this->assertSame($version->getKey(), $component['rule_version_id']);
        $this->assertSame($tax->getKey(), $component['tax_id']);
        $this->assertSame('1833.33', $component['dpp_amount'], '2.000 x 11/12.');
        $this->assertSame('183.33', $component['tax_amount']);
        $this->assertSame('11/12', $component['dpp_factor']);
        $this->assertSame([], $component['warnings']);
        $this->assertSame('183.33', $breakdown['total_additive']);
        $this->assertSame('0.00', $breakdown['total_withholding']);

        // P-5: dihitung ulang dari versi 1, hasilnya sama dengan kolom generated yang tersimpan di dokumen.
        $report = app(TaxEngine::class)->verify(TaxResult::fromArray($breakdown));
        $this->assertTrue($report->passed, json_encode($report->differences));
        $this->assertSame(1, $report->verifiedComponents);
    }

    public function test_items_without_a_version_are_described_as_legacy_and_stay_valid(): void {
        // Invoice yang dibuat sebelum fase ini: tax_id terisi, tax_rule_version_id null (Requirement 5.5).
        $tax     = $this->taxWithVersion('PPN 10', 10);
        $invoice = $this->approvableSalesInvoice(['tax_id' => $tax->getKey(), 'tax_rule_version_id' => null]);

        $approved = $this->approveSales($invoice);

        $component = $approved->tax_breakdown['components'][0];
        $this->assertNull($component['rule_version_id']);
        $this->assertSame('rule_legacy', $approved->tax_breakdown['explanation'][0]['key']);
        $this->assertSame('183.33', $component['tax_amount']);
        $this->assertEqualsWithDelta(2183.33, $approved->amount, 0.01);
    }

    public function test_an_invoice_without_any_taxed_item_has_no_breakdown(): void {
        $invoice = $this->approvableSalesInvoice(['tax_id' => null, 'tax_rate' => 0]);

        $approved = $this->approveSales($invoice);

        $this->assertNull($approved->tax_breakdown);
    }

    public function test_an_existing_breakdown_is_never_recomputed(): void {
        $tax     = $this->taxWithVersion('PPN 10', 10);
        $invoice = $this->approvableSalesInvoice(['tax_id' => $tax->getKey(), 'tax_rule_version_id' => $this->activeVersionOf($tax)->getKey()]);
        $invoice->forceFill(['tax_breakdown' => ['marker' => 'sudah ada']])->save();

        $approved = $this->approveSales($invoice->fresh());

        $this->assertSame(['marker' => 'sudah ada'], $approved->tax_breakdown, 'Immutable setelah tersimpan (Requirement 5.3).');
    }

    public function test_purchase_approval_stores_the_breakdown(): void {
        $tax     = $this->taxWithVersion('PPN 10', 10);
        $version = $this->activeVersionOf($tax);
        $order   = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-SNAP-APP',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->expense->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $order->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_id'              => $tax->getKey(),
            'tax_rate'            => 10,
            'tax_rule_version_id' => $version->getKey(),
        ]);

        app(PurchaseInvoiceService::class)->onApproved($invoice->fresh());

        $breakdown = $invoice->fresh()->tax_breakdown;
        $this->assertSame($version->getKey(), $breakdown['components'][0]['rule_version_id']);
        $this->assertSame('183.33', $breakdown['components'][0]['tax_amount']);
        $this->assertSame('183.33', $breakdown['total_additive']);
    }

    public function test_amended_sales_revision_does_not_inherit_the_breakdown_and_recomputes_on_approval(): void {
        $tax      = $this->taxWithVersion('PPN 10', 10);
        $invoice  = $this->approvableSalesInvoice(['tax_id' => $tax->getKey(), 'tax_rule_version_id' => $this->activeVersionOf($tax)->getKey()]);
        $original = $this->approveSales($invoice);
        $this->assertSame('183.33', $original->tax_breakdown['total_additive']);

        $revision = $original->amend();

        $this->assertNull($revision->fresh()->tax_breakdown, 'Revisi tidak boleh membawa snapshot dokumen asal (Requirement 5.3).');
        $this->assertNotNull($original->fresh()->tax_breakdown, 'Dokumen asal tetap immutable.');

        $other = $this->taxWithVersion('PPN 5', 5);
        $item  = $revision->items()->firstOrFail();
        $item->update(['tax_id' => $other->getKey(), 'tax_rate' => 5, 'tax_rule_version_id' => $this->activeVersionOf($other)->getKey()]);

        $approved = $this->approveSales($revision->fresh());

        $component = $approved->tax_breakdown['components'][0];
        $this->assertSame($other->getKey(), $component['tax_id']);
        $this->assertSame('91.67', $component['tax_amount'], '2.000 x 11/12 x 5%.');
        $this->assertSame('183.33', $original->fresh()->tax_breakdown['total_additive']);
    }

    public function test_amended_purchase_revision_does_not_inherit_the_breakdown(): void {
        $tax   = $this->taxWithVersion('PPN 10', 10);
        $order = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-SNAP-AMD',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
        $invoice = PurchaseInvoice::create([
            'date'              => now()->subDays(3),
            'purchase_order_id' => $order->id,
            'branch_id'         => $this->branch->id,
            'status'            => [FormStatus::SUBMITTED],
            'tax_breakdown'     => ['marker' => 'lama'],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_id'              => $tax->getKey(),
            'tax_rate'            => 10,
        ]);

        $revision = $invoice->fresh()->amend();

        $this->assertNull($revision->fresh()->tax_breakdown);
        $this->assertSame(['marker' => 'lama'], $invoice->fresh()->tax_breakdown);
    }

    public function test_a_range_failure_while_building_the_snapshot_is_described_instead_of_thrown(): void {
        Log::spy();
        $tax  = $this->taxWithVersion('PPN 10', 10);
        $item = new SalesInvoiceItem([
            'tax_id'              => $tax->getKey(),
            'tax_rule_version_id' => $this->activeVersionOf($tax)->getKey(),
            'basic_amount'        => 1.0e300,
            'discount_amount'     => 0,
            'tax_rate'            => 10,
            'dpp_amount'          => 1.0e300,
            'tax_amount'          => 1.0e299,
        ]);

        $result = app(DocumentTaxSnapshot::class)->buildOrDescribeFailure(collect([$item]), CarbonImmutable::parse('2026-03-01'), 2, 'sales_invoice', 'SI-1');

        $this->assertSame([DocumentTaxSnapshot::FAILURE_WARNING], $result['warnings']);
        $this->assertSame([], $result['components']);
        $this->assertSame('0', $result['total_additive']);
        $this->assertStringNotContainsString('#0', json_encode($result), 'Tanpa trace di data dokumen.');
        Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => $message === 'tax.snapshot_build_failed'
            && $context['document_id'] === 'SI-1'
            && $context['tax_ids'] === [$tax->getKey()]
            && $context['exception'] === \RangeException::class)->once();
    }

    public function test_a_snapshot_range_failure_does_not_block_sales_approval(): void {
        Log::spy();
        // Posting GL tidak relevan di sini (nilai sangat besar juga di luar rentang jurnal); yang diuji snapshot.
        Event::fake([SalesInvoiceGeneralLedgerPostingRequested::class]);
        $tax     = $this->taxWithVersion('PPN 10', 10);
        $invoice = $this->approvableSalesInvoice(['tax_id' => $tax->getKey(), 'tax_rule_version_id' => $this->activeVersionOf($tax)->getKey(), 'price' => 1.0e300]);
        $before  = $invoice->items()->firstOrFail()->only(['basic_amount', 'dpp_amount', 'tax_amount', 'tax_rate']);

        $approved = $this->approveSales($invoice->fresh());

        $this->assertSame([DocumentTaxSnapshot::FAILURE_WARNING], $approved->tax_breakdown['warnings']);
        $this->assertSame($before, $approved->items->first()->only(['basic_amount', 'dpp_amount', 'tax_amount', 'tax_rate']), 'Angka dokumen tidak berubah.');
        Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => $message === 'tax.snapshot_build_failed' && $context['document_id'] === $invoice->getKey())->once();
    }

    public function test_a_snapshot_range_failure_does_not_block_purchase_approval(): void {
        Log::spy();
        Event::fake([PurchaseInvoiceGeneralLedgerPostingRequested::class]);
        $tax   = $this->taxWithVersion('PPN 10', 10);
        $order = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-SNAP-FAIL',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->expense->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $order->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 2,
            'rate'                => 1.0e300,
            'tax_id'              => $tax->getKey(),
            'tax_rate'            => 10,
        ]);

        app(PurchaseInvoiceService::class)->onApproved($invoice->fresh());

        $this->assertSame([DocumentTaxSnapshot::FAILURE_WARNING], $invoice->fresh()->tax_breakdown['warnings']);
        Log::shouldHaveReceived('warning')->withArgs(fn (string $message) => $message === 'tax.snapshot_build_failed')->once();
    }
}
