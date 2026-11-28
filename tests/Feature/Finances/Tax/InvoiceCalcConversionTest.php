<?php

namespace Tests\Feature\Finances\Tax;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\StaleTaxRuleVersionException;
use App\Exceptions\Finances\UnmappedWithholdingRoleException;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileAccount;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Posting\PostingRoleRequirements;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Finances\Tax\DocumentTaxRules;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Bagian B (Task 9.3-9.4; Requirement 12.3, 12.4, 8.3, 12.7): `dpp_amount`/`tax_amount`/`amount` item
 * invoice kini dihitung `TaxEngine` dari versi aturan pada tanggal dokumen, bukan kolom generated 11/12. Faktor DPP
 * selain 11/12 diterima, pajak potong (withholding) terpisah dari total dan jurnal memotong piutang/utang, pembulatan
 * `per_document` memakai sisa pada baris terbesar (jurnal tetap seimbang tanpa baris pembulatan), dan dokumen order
 * tidak berubah.
 */
class InvoiceCalcConversionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $income;
    private Account $expense;
    private Account $payable;
    private Account $withholdingReceivable;
    private Account $withholdingPayable;
    private TaxRuleVersionService $versions;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, SalesOrder::class, PurchaseInvoice::class, PurchaseOrder::class]);

        if (! Schema::hasColumn('suppliers', 'lft')) {
            Schema::table('suppliers', function ($table): void {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            });
        }

        $this->receivable            = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->income                = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->expense               = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->payable               = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->withholdingReceivable = $this->makeAccount('1310', 'PPh Dibayar Dimuka', 'asset', 'debit');
        $this->withholdingPayable    = $this->makeAccount('2310', 'Utang PPh', 'liability', 'credit');
        $this->versions              = app(TaxRuleVersionService::class);

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil tes konversi', '2020-01-01', null, [
            'receivable'             => $this->receivable->id,
            'revenue'                => $this->income->id,
            'payable'                => $this->payable->id,
            'expense'                => $this->expense->id,
            'withholding_receivable' => $this->withholdingReceivable->id,
            'withholding_payable'    => $this->withholdingPayable->id,
        ], []));
    }

    /**
     * @param  array<string, mixed>  $version
     * @param  array<string, mixed>  $tax
     */
    private function taxWith(string $name, float $rate, int $numerator, int $denominator, string $from = '2026-01-01', array $version = [], array $tax = []): Tax {
        $model = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => Tax::CATEGORY_PPN_STANDARD, ...$tax]);
        $this->versions->activate($this->versions->createDraft($model, [
            'effective_from'  => $from,
            'rate'            => $rate,
            'dpp_numerator'   => $numerator,
            'dpp_denominator' => $denominator,
            ...$version,
        ]));

        return $model;
    }

    private function withholdingTax(float $rate = 2): Tax {
        return $this->taxWith('PPh 23', $rate, 1, 1, tax: ['category' => Tax::CATEGORY_PPH_23, 'behavior' => Tax::BEHAVIOR_WITHHOLDING]);
    }

    /**
     * @param  list<array{tax: string|null, price: float, quantity?: float}>  $rows
     * @param  array<string, mixed>  $extra
     */
    private function createSalesInvoice(array $rows, string $date = '2026-03-01', array $extra = []): SalesInvoice {
        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $row['tax']],
                'quantity' => $row['quantity'] ?? 1,
                'price'    => $row['price'],
            ];
        }

        return app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => $date,
            'items'           => $items,
            ...$extra,
        ]);
    }

    /**
     * @param  list<array{tax: string|null, price: float, quantity?: float}>  $rows
     * @param  array<string, mixed>  $extra
     */
    private function createPurchaseInvoice(array $rows, string $date = '2026-03-01', array $extra = []): PurchaseInvoice {
        $country  = CountryFactory::new()->create();
        $supplier = Supplier::query()->create(['name' => 'PT Pemasok', 'is_disabled' => false, 'country_id' => $country->code]);
        $order    = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-CALC-' . Str::random(6),
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));

        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $row['tax']],
                'quantity' => $row['quantity'] ?? 1,
                'rate'     => $row['price'],
            ];
        }

        return app(PurchaseInvoiceService::class)->create([
            'purchase_order' => ['id' => $order->id],
            'supplier'       => ['id' => $supplier->id],
            'branch'         => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'           => $date,
            'items'          => $items,
            ...$extra,
        ]);
    }

    private function approveSales(SalesInvoice $invoice): SalesInvoice {
        $invoice->update(['status' => [FormStatus::SUBMITTED]]);
        app(SalesInvoiceService::class)->onApproved($invoice->fresh());

        return $invoice->fresh(['items']);
    }

    private function approvePurchase(PurchaseInvoice $invoice): PurchaseInvoice {
        $invoice->update(['status' => [FormStatus::SUBMITTED]]);
        app(PurchaseInvoiceService::class)->onApproved($invoice->fresh());

        return $invoice->fresh(['items']);
    }

    /**
     * Jurnal (semua `purpose`) sebagai peta `"{sisi}:{akun}"` => jumlah.
     *
     * @return array<string, float>
     */
    private function journalOf(string $invoiceId, ?string $purposeSuffix = null): array {
        $journals = Journal::query()->where('source_id', $invoiceId)->get()
            ->filter(fn (Journal $journal): bool => $purposeSuffix === null || str_ends_with((string) $journal->posting_key, ':' . $purposeSuffix));

        $map = [];
        foreach (GeneralLedger::query()->whereIn('journal_id', $journals->pluck('id'))->get() as $line) {
            $key       = ((float) $line->debit > 0 ? 'D:' : 'C:') . $line->account_id;
            $map[$key] = ($map[$key] ?? 0) + (float) $line->debit + (float) $line->credit;
        }

        return $map;
    }

    private function assertBalanced(array $journal): void {
        $debit  = 0.0;
        $credit = 0.0;
        foreach ($journal as $key => $amount) {
            str_starts_with($key, 'D:') ? $debit += $amount : $credit += $amount;
        }
        $this->assertEqualsWithDelta($debit, $credit, 0.001, 'Jurnal harus seimbang.');
    }

    // ---------------------------------------------------------------------------------------------------------
    // Faktor DPP dari versi aturan (12.3)
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_dpp_factor_guard_is_lifted_after_the_conversion_so_non_11_12_factors_are_accepted(): void {
        // Setelah konversi `tax_engine_calc_enabled` true: faktor selain 11/12 boleh diaktifkan (Requirement 2.7 dan 12.3).
        $this->versions->assertDppFactorAllowed(1, 1);
        $this->versions->assertDppFactorAllowed(3, 4);

        $tax = $this->taxWith('Faktor 1/1', 10, 1, 1);
        $this->assertSame(1, (int) $this->versionOf($tax)->dpp_numerator);
    }

    public function test_sales_item_amounts_use_the_version_dpp_factor_and_rate(): void {
        $flat = $this->taxWith('Pajak 1/1', 10, 1, 1);
        $part = $this->taxWith('Pajak 3/4', 12, 3, 4);

        $items = $this->createSalesInvoice([
            ['tax' => $flat->getKey(), 'price' => 1000],
            ['tax' => $part->getKey(), 'price' => 1000],
            ['tax' => null, 'price' => 1000],
        ])->items()->orderBy('created_at')->get()->keyBy(fn (SalesInvoiceItem $item) => (string) ($item->tax_id ?? 'none'));

        $this->assertEqualsWithDelta(1000, $items[$flat->getKey()]->dpp_amount, 0.001, 'Faktor 1/1: DPP = basis.');
        $this->assertEqualsWithDelta(100, $items[$flat->getKey()]->tax_amount, 0.001);
        $this->assertEqualsWithDelta(750, $items[$part->getKey()]->dpp_amount, 0.001, 'Faktor 3/4.');
        $this->assertEqualsWithDelta(90, $items[$part->getKey()]->tax_amount, 0.001, '750 x 12%.');
        $this->assertEqualsWithDelta(0, $items['none']->dpp_amount, 0.001, 'Tanpa pajak: tidak ada DPP.');
        $this->assertEqualsWithDelta(0, $items['none']->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $items['none']->withholding_amount, 0.001);
    }

    public function test_sales_document_total_is_net_plus_additive_tax(): void {
        $tax     = $this->taxWith('PPN 11/12', 12, 11, 12);
        $invoice = $this->createSalesInvoice([['tax' => $tax->getKey(), 'price' => 1200, 'quantity' => 10]]);

        // basis 12.000, DPP 11.000, PPN 12% = 1.320, total 13.320.
        $this->assertEqualsWithDelta(13_320, $invoice->amount, 0.001);
        $item = $invoice->items()->firstOrFail();
        $this->assertEqualsWithDelta(11_000, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(1_320, $item->tax_amount, 0.001);
    }

    public function test_purchase_item_amount_column_is_computed_as_net_plus_additive_tax(): void {
        $tax     = $this->taxWith('Pajak 3/4', 12, 3, 4);
        $invoice = $this->createPurchaseInvoice([['tax' => $tax->getKey(), 'price' => 1000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertEqualsWithDelta(750, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(90, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(1090, $item->amount, 0.001, 'amount = basis bersih + pajak penambah.');
        $this->assertEqualsWithDelta(1090, $invoice->amount, 0.001);
    }

    public function test_a_new_rate_and_factor_version_changes_numbers_with_no_code_change(): void {
        $tax = $this->taxWith('PPN bertahap', 11, 11, 12, '2026-01-01');
        $v1  = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->firstOrFail();
        $this->versions->activate($this->versions->createNewVersion($v1, '2026-07-01', null, ['rate' => 12, 'dpp_numerator' => 1, 'dpp_denominator' => 1]));

        $before = $this->createSalesInvoice([['tax' => $tax->getKey(), 'price' => 1200]], '2026-06-30')->items()->firstOrFail();
        $after  = $this->createSalesInvoice([['tax' => $tax->getKey(), 'price' => 1200]], '2026-07-01')->items()->firstOrFail();

        $this->assertEqualsWithDelta(1100, $before->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(121, $before->tax_amount, 0.001);
        $this->assertEqualsWithDelta(1200, $after->dpp_amount, 0.001, 'Versi 2 berfaktor 1/1.');
        $this->assertEqualsWithDelta(144, $after->tax_amount, 0.001);
    }

    public function test_numbers_equal_the_legacy_formula_for_an_11_12_version_within_one_minor_unit(): void {
        // Paritas pra/pasca konversi (Requirement 6.4 dan 12.2): versi 1 berfaktor 11/12 menghasilkan angka kolom generated lama.
        $tax = $this->taxWith('PPN 11', 11, 11, 12);
        foreach ([[333.33, 7], [1999.99, 3], [12345.67, 1]] as [$price, $qty]) {
            $item   = $this->createSalesInvoice([['tax' => $tax->getKey(), 'price' => $price, 'quantity' => $qty]])->items()->firstOrFail();
            $basic  = $price * $qty;
            $legacy = $basic * 11 / 12 * 11 / 100;

            $this->assertEqualsWithDelta($basic * 11 / 12, $item->dpp_amount, 0.01);
            $this->assertEqualsWithDelta($legacy, $item->tax_amount, 0.01);
        }
    }

    public function test_item_amounts_cannot_be_forged_through_the_request_payload(): void {
        $tax = $this->taxWith('PPN 11/12', 12, 11, 12);

        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        $invoice = app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => '2026-03-01',
            'items'           => [[
                'id'                 => (string) Str::ulid(),
                'item'               => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'               => ['id' => null],
                'tax'                => ['id' => $tax->getKey()],
                'quantity'           => 1,
                'price'              => 1200,
                'dpp_amount'         => 1,
                'tax_amount'         => 1,
                'withholding_amount' => 999,
            ]],
        ]);

        $item = $invoice->items()->firstOrFail();
        $this->assertEqualsWithDelta(1100, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(132, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $item->withholding_amount, 0.001);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Withholding (12.4)
    // ---------------------------------------------------------------------------------------------------------

    public function test_sales_withholding_is_kept_out_of_tax_amount_and_deducted_from_the_document_total(): void {
        $ppn = $this->taxWith('PPN 11/12', 12, 11, 12);
        $pph = $this->withholdingTax(2);

        $invoice = $this->createSalesInvoice([
            ['tax' => $ppn->getKey(), 'price' => 12_000],
            ['tax' => $pph->getKey(), 'price' => 10_000],
        ]);
        $items = $invoice->items()->get()->keyBy('tax_id');

        $this->assertEqualsWithDelta(1_320, $items[$ppn->getKey()]->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $items[$ppn->getKey()]->withholding_amount, 0.001);
        $this->assertEqualsWithDelta(0, $items[$pph->getKey()]->tax_amount, 0.001, 'PPh potong tidak menambah pajak dokumen.');
        $this->assertEqualsWithDelta(200, $items[$pph->getKey()]->withholding_amount, 0.001, '2% x 10.000.');
        // 12.000 + 10.000 + 1.320 (PPN) - 200 (PPh dipotong)
        $this->assertEqualsWithDelta(23_120, $invoice->amount, 0.001);
    }

    public function test_purchase_withholding_is_kept_out_of_tax_amount_and_deducted_from_the_document_total(): void {
        $pph = $this->withholdingTax(2);

        $invoice = $this->createPurchaseInvoice([['tax' => $pph->getKey(), 'price' => 10_000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertEqualsWithDelta(0, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(200, $item->withholding_amount, 0.001);
        $this->assertEqualsWithDelta(10_000, $item->amount, 0.001, 'amount baris = basis bersih + pajak penambah.');
        $this->assertEqualsWithDelta(9_800, $invoice->amount, 0.001);
    }

    public function test_sales_withholding_journal_debits_withholding_receivable_and_reduces_receivable(): void {
        $ppn = $this->taxWith('PPN 11/12', 12, 11, 12);
        $pph = $this->withholdingTax(2);

        $invoice = $this->createSalesInvoice([
            ['tax' => $ppn->getKey(), 'price' => 12_000],
            ['tax' => $pph->getKey(), 'price' => 10_000],
        ]);
        $approved = $this->approveSales($invoice);

        $this->assertEqualsWithDelta(23_120, $approved->amount, 0.001);
        $journal = $this->journalOf($approved->id);
        $this->assertEqualsWithDelta(23_120, $journal['D:' . $this->receivable->id], 0.01, 'Piutang = total - potongan.');
        $this->assertEqualsWithDelta(200, $journal['D:' . $this->withholdingReceivable->id], 0.01);
        $this->assertEqualsWithDelta(23_320, $journal['C:' . $this->income->id], 0.01, 'Pendapatan = bersih + PPN tertanam (tanpa cutover).');
        $this->assertBalanced($journal);

        $withholdingLine = GeneralLedger::query()->where('account_id', $this->withholdingReceivable->id)->firstOrFail();
        $this->assertSame($this->versionOf($pph)->getKey(), $withholdingLine->tax_rule_version_id);
    }

    public function test_purchase_withholding_journal_credits_withholding_payable_and_reduces_payable(): void {
        $pph = $this->withholdingTax(2);

        $approved = $this->approvePurchase($this->createPurchaseInvoice([['tax' => $pph->getKey(), 'price' => 10_000]]));

        $this->assertEqualsWithDelta(9_800, $approved->amount, 0.001);
        $journal = $this->journalOf($approved->id, 'expense');
        $this->assertEqualsWithDelta(10_000, $journal['D:' . $this->expense->id], 0.01);
        $this->assertEqualsWithDelta(9_800, $journal['C:' . $this->payable->id], 0.01, 'Utang = total - potongan.');
        $this->assertEqualsWithDelta(200, $journal['C:' . $this->withholdingPayable->id], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_a_return_of_a_withholding_invoice_swaps_the_withholding_sides(): void {
        $pph = $this->withholdingTax(2);

        $approved = $this->approveSales($this->createSalesInvoice([['tax' => $pph->getKey(), 'price' => 10_000]]));
        $journal  = $this->journalOf($approved->id);
        $this->assertEqualsWithDelta(200, $journal['D:' . $this->withholdingReceivable->id], 0.01);

        $return = $this->createSalesInvoice([['tax' => $pph->getKey(), 'price' => 10_000]], '2026-03-02', ['return_against' => ['id' => $approved->id]]);
        $this->approveSales($return);

        $returnJournal = $this->journalOf($return->id);
        $this->assertEqualsWithDelta(200, $returnJournal['C:' . $this->withholdingReceivable->id], 0.01);
        $this->assertEqualsWithDelta(9_800, $returnJournal['C:' . $this->receivable->id], 0.01);
        $this->assertBalanced($returnJournal);
    }

    public function test_the_snapshot_reports_withholding_separately_without_mismatch_warnings(): void {
        $ppn = $this->taxWith('PPN 11/12', 12, 11, 12);
        $pph = $this->withholdingTax(2);

        $approved = $this->approveSales($this->createSalesInvoice([
            ['tax' => $ppn->getKey(), 'price' => 12_000],
            ['tax' => $pph->getKey(), 'price' => 10_000],
        ]));
        $breakdown = $approved->tax_breakdown;

        $this->assertSame('1320.00', $breakdown['total_additive']);
        $this->assertSame('200.00', $breakdown['total_withholding']);
        foreach ($breakdown['components'] as $component) {
            $this->assertSame([], $component['warnings'], 'Nilai tersimpan hasil engine harus sama dengan hitung ulang engine.');
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Pembulatan per_document (8.3)
    // ---------------------------------------------------------------------------------------------------------

    public function test_per_document_rounding_puts_the_residual_on_the_largest_line_and_journal_stays_balanced(): void {
        $tax = $this->taxWith('PPN per dokumen', 11, 1, 1, version: ['rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT]);

        // 3 baris 10,05: per baris 1,1055 -> 1,11 (jumlah 3,33); per dokumen 30,15 x 11% = 3,3165 -> 3,32.
        $invoice = $this->createSalesInvoice([
            ['tax' => $tax->getKey(), 'price' => 10.05],
            ['tax' => $tax->getKey(), 'price' => 10.05],
            ['tax' => $tax->getKey(), 'price' => 10.05],
        ]);

        $sum = round((float) $invoice->items()->sum('tax_amount'), 2);
        $this->assertEqualsWithDelta(3.32, $sum, 0.0001, 'Jumlah item = pembulatan sekali per dokumen.');
        $this->assertEqualsWithDelta(30.15 + 3.32, $invoice->amount, 0.0001);

        $approved = $this->approveSales($invoice);
        $journal  = $this->journalOf($approved->id);

        // Jurnal seimbang tanpa baris pembulatan: hanya piutang dan pendapatan.
        $this->assertCount(2, $journal, 'Tidak ada baris peran `rounding` karena sisa sudah ada pada item.');
        $this->assertBalanced($journal);
        $this->assertEqualsWithDelta(33.47, $journal['D:' . $this->receivable->id], 0.001);

        foreach ($approved->tax_breakdown['components'] as $component) {
            $this->assertSame([], $component['warnings'], 'Sisa pembulatan per_document tidak boleh memunculkan peringatan.');
        }
        $this->assertEqualsWithDelta(-0.01, array_sum(array_map(fn (array $component): float => (float) $component['rounding_adjustment'], $approved->tax_breakdown['components'])), 0.0001);
    }

    public function test_per_line_rounding_rounds_each_line(): void {
        $tax = $this->taxWith('PPN per baris', 11, 1, 1);

        $invoice = $this->createSalesInvoice([
            ['tax' => $tax->getKey(), 'price' => 10.05],
            ['tax' => $tax->getKey(), 'price' => 10.05],
            ['tax' => $tax->getKey(), 'price' => 10.05],
        ]);

        $this->assertEqualsWithDelta(3.33, (float) $invoice->items()->sum('tax_amount'), 0.0001);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Dokumen order tidak berubah (12.7)
    // ---------------------------------------------------------------------------------------------------------

    public function test_order_item_tables_are_untouched_by_the_conversion(): void {
        foreach (['sales_order_items', 'purchase_order_items'] as $table) {
            $this->assertFalse(Schema::hasColumn($table, 'withholding_amount'), "{$table} tidak boleh mendapat kolom baru (Requirement 12.7).");
            $generated = collect(Schema::getColumns($table))->filter(fn (array $column): bool => $column['generation'] !== null)->pluck('name')->all();
            $this->assertNotContains('tax_amount', $generated, "{$table}.tax_amount sudah kolom biasa sebelum konversi.");
        }

        foreach (['sales_invoice_items', 'purchase_invoice_items'] as $table) {
            $generated = collect(Schema::getColumns($table))->filter(fn (array $column): bool => $column['generation'] !== null)->pluck('name')->all();
            $this->assertNotContains('dpp_amount', $generated, "{$table}: dpp_amount kini kolom biasa.");
            $this->assertNotContains('tax_amount', $generated, "{$table}: tax_amount kini kolom biasa.");
            $this->assertNotContains('amount', $generated, "{$table}: amount kini kolom biasa.");
            $this->assertContains('basic_amount', $generated, "{$table}: basic_amount (quantity x harga) tetap generated.");
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Prop versi aturan untuk form invoice (12.8)
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_invoice_pages_receive_rule_versions_with_factor_rate_and_behavior(): void {
        $this->withoutVite();
        $ppn     = $this->taxWith('PPN 11/12', 12, 11, 12);
        $pph     = $this->withholdingTax(2);
        $invoice = $this->createSalesInvoice([['tax' => $ppn->getKey(), 'price' => 1200]]);

        $flags   = ['select' => true, 'read' => true, 'create' => true];
        $grant   = [SalesInvoice::class => [0 => [['model' => SalesInvoice::class, 'level' => 0, 'only_creator' => false, 'permissions' => $flags]]]];
        $session = ['permissions' => $grant, 'permissions_version' => '0|0|0|0', 'currentBranch' => null];

        $versions = $this->withSession($session)->withCookie('lang', 'en')->actingAs($this->user)
            ->get(route('salesInvoices.show', $invoice))
            ->assertOk()
            ->viewData('page')['props']['taxRuleVersions'];

        $byTax = collect($versions)->keyBy('tax_id');
        $this->assertSame(11, $byTax[$ppn->getKey()]['dpp_numerator']);
        $this->assertSame(12, $byTax[$ppn->getKey()]['dpp_denominator']);
        $this->assertSame('additive', $byTax[$ppn->getKey()]['behavior']);
        $this->assertSame('withholding', $byTax[$pph->getKey()]['behavior']);
        $this->assertSame('active', $byTax[$pph->getKey()]['status']);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Putaran perbaikan (keputusan pemilik produk 28 November 2026)
    // ---------------------------------------------------------------------------------------------------------

    public function test_legacy_hook_zeroes_rows_without_tax_and_routes_withholding_to_its_own_column(): void {
        $pph     = $this->withholdingTax(2);
        $invoice = $this->createSalesInvoice([['tax' => $pph->getKey(), 'price' => 1000]]);
        $version = $this->versionOf($pph);

        // Penulis lain (factory/seeder) tanpa nilai hitung eksplisit: jaring pengaman legacy.
        $noTax    = SalesInvoiceItem::factory()->create(['sales_invoice_id' => $invoice->id, 'quantity' => 1, 'price' => 1000, 'discount_amount' => 0, 'tax_id' => null, 'tax_rule_version_id' => null, 'tax_rate' => 0]);
        $withheld = SalesInvoiceItem::factory()->create(['sales_invoice_id' => $invoice->id, 'quantity' => 1, 'price' => 1000, 'discount_amount' => 0, 'tax_id' => $pph->getKey(), 'tax_rule_version_id' => $version->getKey(), 'tax_rate' => 2]);

        $this->assertEqualsWithDelta(0, $noTax->fresh()->dpp_amount, 0.001, 'Baris tanpa pajak: dpp 0.');
        $this->assertEqualsWithDelta(0, $noTax->fresh()->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $withheld->fresh()->tax_amount, 0.001, 'Pajak potong tidak masuk tax_amount.');
        $this->assertEqualsWithDelta(20, $withheld->fresh()->withholding_amount, 0.001, '2% x 1.000 (faktor 1/1).');
    }

    public function test_approve_is_rejected_when_the_effective_rule_version_differs_from_the_stored_one(): void {
        $tax     = $this->taxWith('PPN bertahap', 11, 11, 12, '2026-01-01');
        $invoice = $this->createSalesInvoice([['tax' => $tax->getKey(), 'price' => 1200]], '2026-08-01');
        $v1      = $this->versionOf($tax);
        $this->assertSame($v1->getKey(), $invoice->items()->firstOrFail()->tax_rule_version_id);

        // Versi baru berlaku sejak 1 Juli: pada tanggal dokumen versi yang berlaku bukan lagi versi tersimpan.
        $this->versions->activate($this->versions->createNewVersion($v1, '2026-07-01', null, ['rate' => 12]));
        $invoice->update(['status' => [FormStatus::SUBMITTED]]);

        try {
            app(SalesInvoiceService::class)->onApproved($invoice->fresh());
            $this->fail('Approve harus ditolak.');
        } catch (StaleTaxRuleVersionException $exception) {
            $this->assertStringContainsString('PPN bertahap', $exception->getMessage());
        }

        $this->assertSame(0, Journal::query()->where('source_id', $invoice->id)->count());
    }

    public function test_purchase_approve_is_rejected_when_the_effective_rule_version_differs(): void {
        $tax     = $this->taxWith('PPN bertahap', 11, 11, 12, '2026-01-01');
        $invoice = $this->createPurchaseInvoice([['tax' => $tax->getKey(), 'price' => 1200]], '2026-08-01');
        $this->versions->activate($this->versions->createNewVersion($this->versionOf($tax), '2026-07-01', null, ['rate' => 12]));
        $invoice->update(['status' => [FormStatus::SUBMITTED]]);

        $this->expectException(StaleTaxRuleVersionException::class);
        app(PurchaseInvoiceService::class)->onApproved($invoice->fresh());
    }

    public function test_approve_is_rejected_when_the_withholding_role_is_not_mapped(): void {
        $pph = $this->withholdingTax(2);
        PostingProfileAccount::query()->whereIn('role', ['withholding_receivable', 'withholding_payable'])->delete();

        $sales = $this->createSalesInvoice([['tax' => $pph->getKey(), 'price' => 10_000]]);
        $sales->update(['status' => [FormStatus::SUBMITTED]]);
        try {
            app(SalesInvoiceService::class)->onApproved($sales->fresh());
            $this->fail('Approve penjualan harus ditolak.');
        } catch (UnmappedWithholdingRoleException $exception) {
            $this->assertStringContainsString('withholding_receivable', $exception->getMessage());
        }
        $this->assertSame(0, Journal::query()->where('source_id', $sales->id)->count());

        $purchase = $this->createPurchaseInvoice([['tax' => $pph->getKey(), 'price' => 10_000]]);
        $purchase->update(['status' => [FormStatus::SUBMITTED]]);
        $this->expectException(UnmappedWithholdingRoleException::class);
        app(PurchaseInvoiceService::class)->onApproved($purchase->fresh());
    }

    public function test_unmapped_withholding_role_does_not_block_documents_without_withholding(): void {
        $ppn = $this->taxWith('PPN 11/12', 12, 11, 12);
        PostingProfileAccount::query()->whereIn('role', ['withholding_receivable', 'withholding_payable'])->delete();

        $approved = $this->approveSales($this->createSalesInvoice([['tax' => $ppn->getKey(), 'price' => 1200]]));

        $this->assertEqualsWithDelta(1332, $approved->amount, 0.001);
    }

    public function test_withholding_roles_are_required_by_the_posting_profile_warning_list(): void {
        $sales    = array_map(fn ($role) => $role->value, PostingRoleRequirements::for(PostingDocumentType::SalesInvoice));
        $purchase = array_map(fn ($role) => $role->value, PostingRoleRequirements::for(PostingDocumentType::PurchaseInvoice));

        $this->assertContains('withholding_receivable', $sales);
        $this->assertContains('withholding_payable', $purchase);
    }

    public function test_print_attributes_show_dpp_only_for_non_1_1_rows_and_withholding_separately(): void {
        $ppn  = $this->taxWith('PPN 11/12', 12, 11, 12);
        $flat = $this->taxWith('Pajak 1/1', 10, 1, 1);
        $pph  = $this->withholdingTax(2);

        $mixed = $this->createSalesInvoice([
            ['tax' => $ppn->getKey(), 'price' => 12_000],
            ['tax' => $pph->getKey(), 'price' => 10_000],
        ])->load('items');
        $this->assertEqualsWithDelta(11_000, $mixed->printed_dpp_amount, 0.001, 'Basis PPh (10.000) tidak tercampur dengan DPP PPN.');
        $this->assertEqualsWithDelta(200, $mixed->withholding_amount, 0.001);

        $flatOnly = $this->createSalesInvoice([['tax' => $flat->getKey(), 'price' => 1000], ['tax' => $pph->getKey(), 'price' => 1000]])->load('items');
        $this->assertNull($flatOnly->printed_dpp_amount, 'Semua baris berfaktor 1/1 atau potong: DPP tidak dicetak.');
        $this->assertEqualsWithDelta(20, $flatOnly->withholding_amount, 0.001);
    }

    public function test_invoice_page_rule_versions_expose_only_the_fields_the_form_uses(): void {
        $this->taxWith('PPN 11/12', 12, 11, 12, version: ['notes' => 'rahasia']);

        $versions = app(DocumentTaxRules::class)->versionsForClient();

        $this->assertNotEmpty($versions);
        $this->assertEqualsCanonicalizing(
            ['id', 'tax_id', 'status', 'effective_from', 'effective_to', 'rate', 'dpp_numerator', 'dpp_denominator', 'behavior', 'category'],
            array_keys($versions[0]),
        );
    }

    private function versionOf(Tax $tax): TaxRuleVersion {
        return TaxRuleVersion::query()->where('tax_id', $tax->getKey())->where('status', TaxRuleVersion::STATUS_ACTIVE)->firstOrFail();
    }
}
