<?php

namespace Tests\Feature\Finances\Tax;

use App\Enums\FormStatus;
use App\Exceptions\Finances\StaleTaxRuleVersionException;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Accounting\InvoiceTaxComponentsBuilder;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Finances\Tax\InvoiceItemTaxCalculator;
use App\Services\Finances\Tax\InvoicePrintTotals;
use App\Services\Finances\Tax\TaxBreakdownPanel;
use App\Services\Finances\Tax\TaxEngine;
use App\Services\Finances\Tax\TaxInput;
use App\Services\Finances\Tax\TaxInvoiceAmounts;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use App\Services\Finances\Tax\UnclassifiedTaxUsage;
use Carbon\CarbonImmutable;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Pajak majemuk per item Sales/Purchase Invoice (spek finance-multi-tax-per-item, Task 2-7): satu item membawa 1..5
 * pajak, pivot menyimpan kebenaran per pajak, kolom item menjadi cermin Pajak Utama dan agregat, header tetap NET,
 * jurnal dan snapshot membaca pivot. Item satu pajak harus identik dengan perilaku sebelum fitur ini.
 */
class MultiTaxPerItemTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $income;
    private Account $expense;
    private Account $payable;
    private Account $withholdingReceivable;
    private Account $withholdingPayable;
    private Account $taxOutput;
    private Account $taxInput;
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
        $this->taxOutput             = $this->makeAccount('2300', 'PPN Keluaran', 'liability', 'credit');
        $this->taxInput              = $this->makeAccount('1300', 'PPN Masukan', 'asset', 'debit');
        $this->versions              = app(TaxRuleVersionService::class);

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil tes pajak majemuk', '2020-01-01', null, [
            'receivable'             => $this->receivable->id,
            'revenue'                => $this->income->id,
            'payable'                => $this->payable->id,
            'expense'                => $this->expense->id,
            'withholding_receivable' => $this->withholdingReceivable->id,
            'withholding_payable'    => $this->withholdingPayable->id,
            'tax_output'             => $this->taxOutput->id,
            'tax_input'              => $this->taxInput->id,
        ], []));
    }

    /**
     * @param  array<string, mixed>  $version
     * @param  array<string, mixed>  $tax
     */
    private function taxWith(string $name, float $rate, int $numerator, int $denominator, array $version = [], array $tax = []): Tax {
        $model = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => Tax::CATEGORY_PPN_STANDARD, ...$tax]);
        $this->versions->activate($this->versions->createDraft($model, [
            'effective_from'  => '2026-01-01',
            'rate'            => $rate,
            'dpp_numerator'   => $numerator,
            'dpp_denominator' => $denominator,
            ...$version,
        ]));

        return $model;
    }

    private function ppn(): Tax {
        return $this->taxWith('PPN 12', 12, 11, 12);
    }

    private function pph(float $rate = 2): Tax {
        return $this->taxWith('PPh 23', $rate, 1, 1, tax: ['category' => Tax::CATEGORY_PPH_23, 'behavior' => Tax::BEHAVIOR_WITHHOLDING]);
    }

    private function luxury(float $rate = 10): Tax {
        return $this->taxWith('PPnBM', $rate, 1, 1, tax: ['category' => Tax::CATEGORY_PPN_LUXURY]);
    }

    /**
     * @param  list<array<string, mixed>>  $rows  `price`, `quantity?`, `taxes` (id list) atau `tax` (id) tunggal
     */
    private function salesItems(array $rows): array {
        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'id'       => $row['id'] ?? (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'quantity' => $row['quantity'] ?? 1,
                'price'    => $row['price'],
                ...$this->taxPayload($row),
            ];
        }

        return $items;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function taxPayload(array $row): array {
        $payload = [];
        if (array_key_exists('taxes', $row)) {
            $payload['taxes'] = array_map(fn (string $id): array => ['id' => $id], $row['taxes']);
        }
        if (array_key_exists('tax', $row)) {
            $payload['tax'] = ['id' => $row['tax']];
        }

        return $payload;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, mixed>  $extra
     */
    private function createSalesInvoice(array $rows, string $date = '2026-03-01', array $extra = []): SalesInvoice {
        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        return app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => $date,
            'items'           => $this->salesItems($rows),
            ...$extra,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $rows  `price`, `quantity?`, `taxes`/`tax`
     * @param  array<string, mixed>  $extra
     */
    private function createPurchaseInvoice(array $rows, string $date = '2026-03-01', array $extra = []): PurchaseInvoice {
        $country  = CountryFactory::new()->create();
        $supplier = Supplier::query()->create(['name' => 'PT Pemasok', 'is_disabled' => false, 'country_id' => $country->code]);
        $order    = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-MT-' . Str::random(6),
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));

        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'id'       => $row['id'] ?? (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'quantity' => $row['quantity'] ?? 1,
                'rate'     => $row['price'],
                ...$this->taxPayload($row),
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

    private function enableSplit(): void {
        $today = CarbonImmutable::parse(app(FiscalPeriodService::class)->businessDay(now()))->toDateString();
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['tax_split_from' => ['sales_invoice' => $today, 'purchase_invoice' => $today]]);
    }

    /**
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

    /**
     * @param  array<string, float>  $journal
     */
    private function assertBalanced(array $journal): void {
        $debit  = 0.0;
        $credit = 0.0;
        foreach ($journal as $key => $amount) {
            str_starts_with($key, 'D:') ? $debit += $amount : $credit += $amount;
        }
        $this->assertEqualsWithDelta($debit, $credit, 0.001, 'Jurnal harus seimbang.');
    }

    /** Invarian: tax_amount item = Σ pivot penambah, withholding item = Σ pivot potong, tax_id = pivot position 0. */
    private function assertItemAggregatesMatchPivot(SalesInvoiceItem|PurchaseInvoiceItem $item): void {
        $lines = $item->taxLines()->get();
        $this->assertEqualsWithDelta($lines->sum('tax_amount'), $item->tax_amount, 0.0001, 'tax_amount item = Σ pivot.');
        $this->assertEqualsWithDelta($lines->sum('withholding_amount'), $item->withholding_amount, 0.0001, 'withholding_amount item = Σ pivot.');
        $this->assertSame($lines->first()?->tax_id, $item->tax_id, 'tax_id item = Pajak Utama (position 0).');
        $this->assertSame($lines->first()?->tax_rule_version_id, $item->tax_rule_version_id);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Satu pajak: identik dengan sebelum fitur
    // ---------------------------------------------------------------------------------------------------------

    public function test_a_single_tax_through_taxes_and_through_tax_gives_identical_numbers(): void {
        $ppn = $this->ppn();

        $viaTax   = $this->createSalesInvoice([['tax' => $ppn->getKey(), 'price' => 1200, 'quantity' => 10]]);
        $viaTaxes = $this->createSalesInvoice([['taxes' => [$ppn->getKey()], 'price' => 1200, 'quantity' => 10]]);

        foreach ([$viaTax, $viaTaxes] as $invoice) {
            $item = $invoice->items()->firstOrFail();
            $this->assertEqualsWithDelta(11_000, $item->dpp_amount, 0.001);
            $this->assertEqualsWithDelta(1_320, $item->tax_amount, 0.001);
            $this->assertEqualsWithDelta(13_320, $invoice->amount, 0.001);
            $this->assertEqualsWithDelta(12.0, $item->tax_rate, 0.0001);
            $this->assertSame($ppn->getKey(), $item->tax_id);

            $lines = $item->taxLines()->get();
            $this->assertCount(1, $lines);
            $this->assertSame(0, $lines[0]->position);
            $this->assertEqualsWithDelta(1_320, $lines[0]->tax_amount, 0.001);
            $this->assertEqualsWithDelta(11_000, $lines[0]->dpp_amount, 0.001);
            $this->assertEqualsWithDelta(12_000, $lines[0]->base_amount, 0.001);
            $this->assertEqualsWithDelta(11 / 12, $lines[0]->dpp_factor, 0.0001);
            $this->assertSame($this->versionOf($ppn)->getKey(), $lines[0]->tax_rule_version_id);
            $this->assertItemAggregatesMatchPivot($item);
        }
    }

    public function test_when_both_tax_and_taxes_are_sent_taxes_wins(): void {
        $ppn = $this->ppn();
        $pph = $this->pph();

        $invoice = $this->createSalesInvoice([['tax' => $pph->getKey(), 'taxes' => [$ppn->getKey()], 'price' => 1000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertSame($ppn->getKey(), $item->tax_id);
        $this->assertCount(1, $item->taxLines()->get());
    }

    public function test_an_item_without_tax_has_no_pivot_rows_and_zero_amounts(): void {
        $invoice = $this->createSalesInvoice([['taxes' => [], 'price' => 1000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertNull($item->tax_id);
        $this->assertSame(0, $item->taxLines()->count());
        $this->assertEqualsWithDelta(0, $item->tax_amount, 0.0001);
        $this->assertEqualsWithDelta(1000, $invoice->amount, 0.0001);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Perhitungan: PPN + PPh, dua penambah, per_document lintas pajak, header NET
    // ---------------------------------------------------------------------------------------------------------

    public function test_ppn_plus_withholding_on_one_item_keeps_one_basis_and_net_header(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        // Jasa Rp1.000.000: PPN 12% x DPP 11/12 = 110.000, PPh 23 2% x 1.000.000 = 20.000.
        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.001, 'Agregat penambah = PPN saja.');
        $this->assertEqualsWithDelta(20_000, $item->withholding_amount, 0.001);
        $this->assertEqualsWithDelta(1_000_000 * 11 / 12, $item->dpp_amount, 0.01, 'DPP = DPP pajak PPN pertama.');
        $this->assertSame($ppn->getKey(), $item->tax_id);
        $this->assertEqualsWithDelta(1_090_000, $invoice->amount, 0.001, 'NET = bersih + penambah - potong, basis tidak tergandakan.');

        $lines = $item->taxLines()->get()->keyBy('tax_id');
        $this->assertCount(2, $lines);
        $this->assertSame(0, $lines[$ppn->getKey()]->position);
        $this->assertSame(1, $lines[$pph->getKey()]->position);
        $this->assertEqualsWithDelta(1_000_000, $lines[$pph->getKey()]->base_amount, 0.001, 'Basis PPh = basis bersih item yang sama.');
        $this->assertEqualsWithDelta(0, $lines[$pph->getKey()]->tax_amount, 0.001);
        $this->assertEqualsWithDelta(20_000, $lines[$pph->getKey()]->withholding_amount, 0.001);
        $this->assertItemAggregatesMatchPivot($item);
    }

    public function test_the_primary_dpp_prefers_the_first_ppn_then_the_first_additive_then_the_first_tax(): void {
        $ppn    = $this->ppn();
        $pph    = $this->pph(2);
        $luxury = $this->luxury(10);

        // PPh lebih dulu, PPN kedua: DPP tetap DPP PPN (kategori PPN pertama).
        $withPpn = $this->createSalesInvoice([['taxes' => [$pph->getKey(), $ppn->getKey()], 'price' => 1_200_000]])->items()->firstOrFail();
        $this->assertEqualsWithDelta(1_100_000, $withPpn->dpp_amount, 0.01);
        $this->assertSame($pph->getKey(), $withPpn->tax_id, 'Pajak Utama = pajak pertama, bukan PPN.');

        // Tanpa PPN: penambah pertama.
        $noPpn = $this->createSalesInvoice([['taxes' => [$pph->getKey(), $luxury->getKey()], 'price' => 1_000_000]])->items()->firstOrFail();
        $this->assertEqualsWithDelta(1_000_000, $noPpn->dpp_amount, 0.01);

        // Hanya pajak potong: DPP pajak pertama.
        $onlyWithholding = $this->createSalesInvoice([['taxes' => [$pph->getKey()], 'price' => 1_000_000]])->items()->firstOrFail();
        $this->assertEqualsWithDelta(1_000_000, $onlyWithholding->dpp_amount, 0.01);
    }

    public function test_two_additive_taxes_sum_into_the_item_tax_amount_without_tax_on_tax(): void {
        $ppn    = $this->ppn();
        $luxury = $this->luxury(10);

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $luxury->getKey()], 'price' => 1_200_000]]);
        $item    = $invoice->items()->firstOrFail();

        // PPN 12% x 1.100.000 = 132.000; PPnBM 10% x 1.200.000 = 120.000 (basis sama, bukan atas PPN).
        $this->assertEqualsWithDelta(252_000, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(1_452_000, $invoice->amount, 0.001);
        $this->assertItemAggregatesMatchPivot($item);
    }

    public function test_purchase_invoice_amount_column_is_net_plus_additive_taxes(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $invoice = $this->createPurchaseInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]);
        $item    = $invoice->items()->firstOrFail();

        $this->assertEqualsWithDelta(110_000, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(20_000, $item->withholding_amount, 0.001);
        $this->assertEqualsWithDelta(1_110_000, $item->amount, 0.001, 'amount = bersih + tax_amount (penambah).');
        $this->assertEqualsWithDelta(1_090_000, $invoice->amount, 0.001);
        $this->assertCount(2, $item->taxLines()->get());
        $this->assertItemAggregatesMatchPivot($item);
    }

    public function test_per_document_rounding_spans_items_and_taxes_of_the_same_version(): void {
        $perDocument = $this->taxWith('PPN per dokumen', 11, 1, 1, version: ['rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT]);
        $other       = $this->taxWith('Pajak lain per dokumen', 5, 1, 1, version: ['rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT], tax: ['category' => Tax::CATEGORY_OTHER]);

        $rows = [
            ['taxes' => [$perDocument->getKey(), $other->getKey()], 'price' => 10.05],
            ['taxes' => [$perDocument->getKey(), $other->getKey()], 'price' => 10.05],
            ['taxes' => [$perDocument->getKey(), $other->getKey()], 'price' => 10.05],
        ];
        $invoice = $this->createSalesInvoice($rows);

        // Engine langsung atas pasangan yang sama: pembulatan sekali per versi (lintas item).
        $inputs = [];
        foreach ($invoice->items()->get() as $item) {
            foreach ([$perDocument, $other] as $tax) {
                $inputs[] = new TaxInput($tax->getKey(), 10.05, CarbonImmutable::parse('2026-03-01'), 2, $item->getKey() . '#' . $tax->getKey());
            }
        }
        $expected = array_sum(array_map(fn ($component): float => (float) $component->taxAmount, app(TaxEngine::class)->calculateDocument($inputs)->components));

        $pivotSum = (float) $invoice->items()->get()->flatMap->taxLines->sum('tax_amount');
        $this->assertEqualsWithDelta($expected, $pivotSum, 0.0001, 'Σ pivot = hasil engine per_document.');
        $this->assertEqualsWithDelta(3.32 + 1.51, $pivotSum, 0.0001, '30,15 x 11% = 3,3165 -> 3,32; 30,15 x 5% = 1,5075 -> 1,51.');
        $this->assertEqualsWithDelta($pivotSum, (float) $invoice->items()->sum('tax_amount'), 0.0001, 'Σ pivot = Σ agregat item.');
        $this->assertEqualsWithDelta(30.15 + $pivotSum, $invoice->amount, 0.0001);
    }

    public function test_document_discount_with_multiple_taxes_keeps_header_equal_to_sum_of_items(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        foreach ([['net_total', 10], ['grand_total', 10]] as [$basis, $rate]) {
            $invoice = $this->createSalesInvoice([
                ['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000],
                ['taxes' => [$ppn->getKey()], 'price' => 500_000],
            ], extra: ['discount_on' => $basis, 'discount_rate' => $rate, 'discount_amount' => $basis === 'net_total' ? 150_000 : 165_000]);

            $items = $invoice->items()->get();
            $net   = (float) $items->sum(fn (SalesInvoiceItem $item): float => $item->basic_amount - $item->discount_amount);
            $tax   = (float) $items->sum('tax_amount');
            $wh    = (float) $items->sum('withholding_amount');

            $this->assertGreaterThan(0, $items->sum('discount_amount'), "{$basis}: diskon teralokasi.");
            $this->assertEqualsWithDelta($net + $tax - $wh, $invoice->amount, 0.0001, "{$basis}: header NET = Σ item.");
            foreach ($items as $item) {
                $this->assertItemAggregatesMatchPivot($item);
            }
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Kombinasi terlarang dan versi: gagal tertutup di service
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_service_rejects_forbidden_combinations_and_leaves_nothing_behind(): void {
        $ppn  = $this->ppn();
        $ppn2 = $this->taxWith('PPN 11', 11, 11, 12);
        $pph  = $this->pph();

        $cases = [
            'duplikat' => [$pph->getKey(), $pph->getKey()],
            'dua PPN'  => [$ppn->getKey(), $ppn2->getKey()],
            'lebih 5'  => array_map(fn (int $i): string => $this->taxWith("Lain {$i}", 1, 1, 1, tax: ['category' => Tax::CATEGORY_OTHER])->getKey(), range(1, 6)),
        ];

        foreach ($cases as $label => $ids) {
            try {
                $this->createSalesInvoice([['taxes' => $ids, 'price' => 1000]]);
                $this->fail("Kombinasi {$label} harus ditolak.");
            } catch (ValidationException $e) {
                $this->assertSame(['items.0.taxes'], array_keys($e->errors()), $label);
            }
        }

        $this->assertSame(0, SalesInvoice::query()->count(), 'Tidak boleh ada header yatim.');
        $this->assertSame(0, SalesInvoiceItem::query()->count());

        try {
            $this->createPurchaseInvoice([['taxes' => [$ppn->getKey(), $ppn2->getKey()], 'price' => 1000]]);
            $this->fail('Purchase Invoice juga menolak dua PPN standar.');
        } catch (ValidationException $e) {
            $this->assertSame(['items.0.taxes'], array_keys($e->errors()));
        }
        $this->assertSame(0, PurchaseInvoice::query()->count());
    }

    public function test_a_withholding_tax_with_a_standard_ppn_and_an_unclassified_tax_are_allowed(): void {
        $ppn          = $this->ppn();
        $pph          = $this->pph();
        $unclassified = $this->taxWith('Pajak lama', 3, 1, 1, tax: ['category' => Tax::CATEGORY_UNCLASSIFIED]);

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey(), $unclassified->getKey()], 'price' => 1_000_000]]);

        $this->assertCount(3, $invoice->items()->firstOrFail()->taxLines()->get());
    }

    public function test_a_second_tax_without_an_effective_version_fails_closed_on_its_own_position(): void {
        $ppn         = $this->ppn();
        $unversioned = Tax::query()->create(['name' => 'Pajak tanpa versi', 'rate' => 5]);

        try {
            $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $unversioned->getKey()], 'price' => 1000]]);
            $this->fail('Pajak tanpa versi harus menggagalkan pembuatan invoice.');
        } catch (ValidationException $e) {
            $this->assertSame(['items.0.taxes.1'], array_keys($e->errors()));
            $this->assertStringContainsString('Pajak tanpa versi', $e->errors()['items.0.taxes.1'][0]);
        }

        $this->assertSame(0, SalesInvoice::query()->count(), 'Versi semua pajak di-resolve sebelum menulis apa pun.');
    }

    public function test_item_amounts_and_pivot_values_cannot_be_forged_through_the_request_payload(): void {
        $ppn = $this->ppn();

        $invoice = $this->createSalesInvoice([[
            'taxes' => [$ppn->getKey()],
            'price' => 1200,
        ]]);
        $item = $invoice->items()->firstOrFail();
        $item->taxLines()->firstOrFail();

        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        $forged = app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => '2026-03-01',
            'items'           => [[
                'id'                  => (string) Str::ulid(),
                'item'                => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'                => ['id' => null],
                'taxes'               => [['id' => $ppn->getKey(), 'tax_amount' => 999, 'dpp_amount' => 999, 'pivot' => ['tax_amount' => 999], 'tax_rate' => 99, 'withholding_amount' => 999]],
                'quantity'            => 1,
                'price'               => 1200,
                'tax_rate'            => 99,
                'tax_rule_version_id' => (string) Str::ulid(),
                'dpp_amount'          => 1,
                'tax_amount'          => 1,
                'withholding_amount'  => 999,
            ]],
        ]);

        $forgedItem = $forged->items()->firstOrFail();
        $line       = $forgedItem->taxLines()->firstOrFail();
        $this->assertEqualsWithDelta(132, $forgedItem->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $forgedItem->withholding_amount, 0.001);
        $this->assertEqualsWithDelta(12, $forgedItem->tax_rate, 0.0001);
        $this->assertSame($this->versionOf($ppn)->getKey(), $forgedItem->tax_rule_version_id);
        $this->assertEqualsWithDelta(132, $line->tax_amount, 0.001);
        $this->assertEqualsWithDelta(1100, $line->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(12, $line->tax_rate, 0.0001);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Update draft: tambah, hapus, urut ulang pajak
    // ---------------------------------------------------------------------------------------------------------

    public function test_updating_a_draft_adds_removes_and_reorders_item_taxes_without_orphans(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey()], 'price' => 1_000_000]]);
        $item    = $invoice->items()->firstOrFail();

        $payload = fn (array $taxIds): array => [
            'customer'          => ['id' => $invoice->customer_id],
            'customer_branch'   => ['id' => $invoice->customer_branch_id],
            'branch'            => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'              => '2026-03-01',
            'payment_schedules' => [],
            'items'             => [[
                'id'       => $item->id,
                'item'     => ['id' => $item->item_id],
                'unit'     => ['id' => null],
                'taxes'    => array_map(fn (string $id): array => ['id' => $id], $taxIds),
                'quantity' => 1,
                'price'    => 1_000_000,
            ]],
        ];

        // Tambah PPh: dua baris pivot, header NET.
        app(SalesInvoiceService::class)->update($invoice->fresh(), $payload([$ppn->getKey(), $pph->getKey()]));
        $item = $item->fresh();
        $this->assertSame([$ppn->getKey(), $pph->getKey()], $item->taxLines()->pluck('tax_id')->all());
        $this->assertEqualsWithDelta(1_090_000, $invoice->fresh()->amount, 0.001);
        $this->assertItemAggregatesMatchPivot($item);

        // Urut ulang: PPh menjadi Pajak Utama, tidak ada baris ganda.
        app(SalesInvoiceService::class)->update($invoice->fresh(), $payload([$pph->getKey(), $ppn->getKey()]));
        $item = $item->fresh();
        $this->assertSame([$pph->getKey(), $ppn->getKey()], $item->taxLines()->pluck('tax_id')->all());
        $this->assertSame($pph->getKey(), $item->tax_id);
        $this->assertSame(2, $item->taxLines()->count());
        $this->assertItemAggregatesMatchPivot($item);

        // Hapus PPh: tinggal PPN, tanpa pivot yatim.
        app(SalesInvoiceService::class)->update($invoice->fresh(), $payload([$ppn->getKey()]));
        $item = $item->fresh();
        $this->assertSame([$ppn->getKey()], $item->taxLines()->pluck('tax_id')->all());
        $this->assertEqualsWithDelta(1_110_000, $invoice->fresh()->amount, 0.001);
        $this->assertEqualsWithDelta(0, $item->withholding_amount, 0.001);

        // Tanpa pajak sama sekali: semua pivot hilang.
        app(SalesInvoiceService::class)->update($invoice->fresh(), $payload([]));
        $this->assertSame(0, $item->fresh()->taxLines()->count());
        $this->assertNull($item->fresh()->tax_id);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Jurnal
    // ---------------------------------------------------------------------------------------------------------

    public function test_sales_journal_with_ppn_and_withholding_on_one_item_balances_without_cutover(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved = $this->approveSales($this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]));
        $journal  = $this->journalOf($approved->id);

        $this->assertEqualsWithDelta(1_090_000, $approved->amount, 0.001);
        $this->assertEqualsWithDelta(1_090_000, $journal['D:' . $this->receivable->id], 0.01, 'Piutang = NET.');
        $this->assertEqualsWithDelta(20_000, $journal['D:' . $this->withholdingReceivable->id], 0.01);
        $this->assertEqualsWithDelta(1_110_000, $journal['C:' . $this->income->id], 0.01, 'Pendapatan = bersih + PPN tertanam (tanpa cutover).');
        $this->assertBalanced($journal);
    }

    public function test_sales_journal_with_cutover_splits_each_tax_with_its_line_share(): void {
        $this->enableSplit();
        $ppn    = $this->ppn();
        $luxury = $this->luxury(10);
        $pph    = $this->pph(2);

        $approved = $this->approveSales($this->createSalesInvoice([
            ['taxes' => [$ppn->getKey(), $luxury->getKey(), $pph->getKey()], 'price' => 1_200_000],
            ['taxes' => [$ppn->getKey()], 'price' => 600_000],
        ]));
        $journal = $this->journalOf($approved->id);

        // PPN = 132.000 + 66.000 = 198.000; PPnBM = 120.000; PPh = 24.000.
        $items = $approved->items()->get();
        $this->assertEqualsWithDelta(318_000, (float) $items->sum('tax_amount'), 0.01);
        $this->assertEqualsWithDelta(24_000, (float) $items->sum('withholding_amount'), 0.01);
        $this->assertEqualsWithDelta(1_800_000, $journal['C:' . $this->income->id], 0.01, 'Pendapatan = sisa setelah semua bagian pajak terpisah.');
        $this->assertEqualsWithDelta(318_000, $journal['C:' . $this->taxOutput->id], 0.01, 'Σ pajak jurnal = Σ pivot = Σ agregat item.');
        $this->assertEqualsWithDelta(24_000, $journal['D:' . $this->withholdingReceivable->id], 0.01);
        $this->assertEqualsWithDelta(1_800_000 + 318_000 - 24_000, $journal['D:' . $this->receivable->id], 0.01);
        $this->assertBalanced($journal);

        $taxLines = $items->flatMap->taxLines;
        $this->assertEqualsWithDelta($taxLines->sum('tax_amount'), $items->sum('tax_amount'), 0.0001);
    }

    public function test_purchase_journal_with_ppn_and_withholding_on_one_item_balances(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved = $this->approvePurchase($this->createPurchaseInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]));
        $journal  = $this->journalOf($approved->id, 'expense');

        $this->assertEqualsWithDelta(1_090_000, $approved->amount, 0.001);
        $this->assertEqualsWithDelta(1_110_000, $journal['D:' . $this->expense->id], 0.01);
        $this->assertEqualsWithDelta(1_090_000, $journal['C:' . $this->payable->id], 0.01, 'Utang = NET.');
        $this->assertEqualsWithDelta(20_000, $journal['C:' . $this->withholdingPayable->id], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_a_return_of_a_multi_tax_invoice_carries_the_same_taxes_and_swaps_the_journal(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved = $this->approveSales($this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]));
        $return   = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]], '2026-03-02', ['return_against' => ['id' => $approved->id]]);
        $this->assertCount(2, $return->items()->firstOrFail()->taxLines()->get());
        $this->approveSales($return);

        $journal = $this->journalOf($return->id);
        $this->assertEqualsWithDelta(20_000, $journal['C:' . $this->withholdingReceivable->id], 0.01);
        $this->assertEqualsWithDelta(1_090_000, $journal['C:' . $this->receivable->id], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_approve_is_rejected_when_any_item_tax_has_a_stale_version(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]], '2026-08-01');

        // Versi baru PPh berlaku sejak 1 Juli: versi tersimpan pada pajak NON-utama menjadi usang.
        $this->versions->activate($this->versions->createNewVersion($this->versionOf($pph), '2026-07-01', null, ['rate' => 3]));
        $invoice->update(['status' => [FormStatus::SUBMITTED]]);

        try {
            app(SalesInvoiceService::class)->onApproved($invoice->fresh());
            $this->fail('Approve harus ditolak.');
        } catch (StaleTaxRuleVersionException $exception) {
            $this->assertStringContainsString('PPh 23', $exception->getMessage());
        }

        $this->assertSame(0, Journal::query()->where('source_id', $invoice->id)->count());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Snapshot dan Faktur Pajak
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_snapshot_has_one_component_per_pivot_row_with_composite_line_refs(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved  = $this->approveSales($this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]));
        $item      = $approved->items()->firstOrFail();
        $breakdown = $approved->tax_breakdown;

        $this->assertCount(2, $breakdown['components']);
        $refs = array_column($breakdown['components'], 'line_ref');
        $this->assertEqualsCanonicalizing([$item->id . '#' . $ppn->getKey(), $item->id . '#' . $pph->getKey()], $refs);
        $this->assertSame('110000.00', $breakdown['total_additive']);
        $this->assertSame('20000.00', $breakdown['total_withholding']);
        foreach ($breakdown['components'] as $component) {
            $this->assertSame([], $component['warnings'], 'Nilai tersimpan harus sama dengan hitung ulang engine.');
        }
    }

    public function test_the_tax_invoice_takes_only_ppn_components_from_the_snapshot(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved = $this->approveSales($this->createSalesInvoice([['taxes' => [$pph->getKey(), $ppn->getKey()], 'price' => 1_200_000]]));

        $amounts = TaxInvoiceAmounts::fromBreakdown($approved->tax_breakdown);
        $this->assertEqualsWithDelta(1_100_000, $amounts['dpp'], 0.01);
        $this->assertEqualsWithDelta(132_000, $amounts['ppn'], 0.01, 'PPh tidak masuk kolom PPN.');
    }

    public function test_the_fallback_tax_invoice_sums_never_include_withholding_even_when_ppn_is_not_first(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $invoice = $this->createSalesInvoice([['taxes' => [$pph->getKey(), $ppn->getKey()], 'price' => 1_200_000]]);

        // Jalur fallback `sum(items.dpp_amount)` / `sum(items.tax_amount)` (snapshot kosong/belum ada).
        $this->assertEqualsWithDelta(1_100_000, (float) $invoice->items()->sum('dpp_amount'), 0.01, 'DPP agregat = DPP PPN, bukan basis PPh.');
        $this->assertEqualsWithDelta(132_000, (float) $invoice->items()->sum('tax_amount'), 0.01, 'tax_amount agregat hanya pajak penambah.');
    }

    public function test_the_print_attributes_list_every_tax_and_dpp_comes_from_the_pivot(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_200_000]])->load(['items.taxes', 'items.taxLines']);

        $this->assertSame('PPN 12, PPh 23', $invoice->items[0]->tax_names);
        $this->assertSame('12%, 2%', $invoice->items[0]->tax_rates);
        $this->assertEqualsWithDelta(1_100_000, $invoice->printed_dpp_amount, 0.01, 'DPP hanya dari pajak penambah berfaktor selain 1/1.');
        $this->assertEqualsWithDelta(24_000, $invoice->withholding_amount, 0.01);

        $this->assertNull(SalesInvoiceItem::query()->first()->tax_names, 'Tanpa relasi `taxes` dimuat: null, tanpa query tambahan.');
    }

    // ---------------------------------------------------------------------------------------------------------
    // Jaring pengaman baca: item ber-tax_id tanpa pivot
    // ---------------------------------------------------------------------------------------------------------

    public function test_an_item_with_a_tax_id_but_no_pivot_rows_is_read_as_a_single_tax(): void {
        $ppn = $this->ppn();

        $approved = $this->approveSales($this->createSalesInvoice([['taxes' => [$ppn->getKey()], 'price' => 1_200_000]]));
        $item     = $approved->items()->firstOrFail();
        $item->taxLines()->delete();
        $item->unsetRelation('taxLines');

        $reloaded = $approved->fresh();
        $reloaded->load('items');
        $this->assertSame('PPN 12', collect($reloaded->items)->first()->tax?->name);

        $components = (new InvoiceTaxComponentsBuilder)->build($reloaded->items, false, true);
        $this->assertCount(1, $components);
        $this->assertEqualsWithDelta(132_000, $components[0]->amount, 0.01);
        $this->assertEqualsWithDelta(1_100_000, (new InvoicePrintTotals(app(TaxRuleResolver::class)))->dpp($reloaded->items), 0.01);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Calculator langsung
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_calculator_without_item_tax_ids_keeps_the_single_tax_behavior(): void {
        $ppn     = $this->ppn();
        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey()], 'price' => 1_200_000]]);
        $items   = $invoice->items()->get();

        $totals = app(InvoiceItemTaxCalculator::class)->apply($items, [0.0], CarbonImmutable::parse('2026-03-01'), 2, false);

        $this->assertEqualsWithDelta(132_000, $totals['tax'], 0.001);
        $this->assertSame(1, $items[0]->taxLines()->count());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Panel rincian pajak dan pemakaian pajak (pivot, bukan hanya Pajak Utama)
    // ---------------------------------------------------------------------------------------------------------

    public function test_the_breakdown_panel_splits_composite_line_refs_into_one_row_per_pair(): void {
        $ppn = $this->ppn();
        $pph = $this->pph(2);

        $approved = $this->approveSales($this->createSalesInvoice([
            ['taxes' => [$ppn->getKey()], 'price' => 600_000],
            ['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000],
        ]));

        $panel = app(TaxBreakdownPanel::class)->build($approved);

        $this->assertSame('snapshot', $panel['state']);
        $this->assertCount(3, $panel['rows']);
        $this->assertSame([1, 2, 2], array_column($panel['rows'], 'line'), 'Nomor baris dipecah dari bagian id item.');
        $byTax = collect($panel['rows'])->where('line', 2)->keyBy('tax_id');
        $this->assertSame('withholding', $byTax[$pph->getKey()]['behavior']);
        $this->assertSame('20000.00', $byTax[$pph->getKey()]['tax_amount']);
    }

    public function test_the_breakdown_panel_still_reads_old_snapshots_whose_line_ref_is_only_the_item_id(): void {
        $ppn      = $this->ppn();
        $approved = $this->approveSales($this->createSalesInvoice([['taxes' => [$ppn->getKey()], 'price' => 1_200_000]]));
        $item     = $approved->items()->firstOrFail();

        $stored                              = $approved->tax_breakdown;
        $stored['components'][0]['line_ref'] = $item->id;
        $approved->forceFill(['tax_breakdown' => $stored])->saveQuietly();

        $panel = app(TaxBreakdownPanel::class)->build($approved->fresh());
        $this->assertSame(1, $panel['rows'][0]['line']);
    }

    public function test_the_pending_panel_of_a_draft_lists_every_pivot_row(): void {
        $ppn   = $this->ppn();
        $pph   = $this->pph(2);
        $draft = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]);

        $panel = app(TaxBreakdownPanel::class)->build($draft);

        $this->assertSame('pending', $panel['state']);
        $this->assertCount(2, $panel['rows']);
    }

    public function test_unclassified_usage_counts_an_invoice_through_a_non_primary_tax(): void {
        $ppn          = $this->ppn();
        $unclassified = $this->taxWith('Pajak lama', 3, 1, 1, tax: ['category' => Tax::CATEGORY_UNCLASSIFIED]);

        $draftOnly = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $unclassified->getKey()], 'price' => 1_000_000]]);
        $this->assertSame(0, app(UnclassifiedTaxUsage::class)->invoiceCounts($unclassified->getKey(), now())['sales_invoices'], 'Invoice draf tidak dihitung.');

        $draftOnly->forceFill(['status' => [FormStatus::UNPAID], 'date' => now()->toDateString()])->saveQuietly();
        $this->assertSame(1, app(UnclassifiedTaxUsage::class)->invoiceCounts($unclassified->getKey(), now())['sales_invoices'], 'Pajak non-utama ikut terhitung lewat pivot.');
        $this->assertSame(0, app(UnclassifiedTaxUsage::class)->invoiceCounts($unclassified->getKey(), now())['purchase_invoices']);

        // Item lama tanpa pivot dihitung lewat kolom tax_id; invoice yang sama tidak terhitung ganda.
        $draftOnly->items()->firstOrFail()->taxLines()->delete();
        $draftOnly->items()->update(['tax_id' => $unclassified->getKey()]);
        $this->assertSame(1, app(UnclassifiedTaxUsage::class)->invoiceCounts($unclassified->getKey(), now())['sales_invoices']);
    }

    public function test_the_unclassified_report_command_counts_pivot_rows_and_legacy_items_once(): void {
        $ppn          = $this->ppn();
        $unclassified = $this->taxWith('Pajak lama', 3, 1, 1, tax: ['category' => Tax::CATEGORY_UNCLASSIFIED]);

        $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $unclassified->getKey()], 'price' => 1_000_000]]);
        $legacy = $this->createSalesInvoice([['taxes' => [$unclassified->getKey()], 'price' => 1_000_000]]);
        $legacy->items()->firstOrFail()->taxLines()->delete();

        $this->assertSame(0, Artisan::call('finance:report-unclassified-taxes'));
        $this->assertMatchesRegularExpression('/Pajak lama\s*\|\s*3\s*\|\s*2\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|/', Artisan::output(), 'Satu baris lewat pivot non-utama, satu item lama tanpa pivot.');
    }

    // ---------------------------------------------------------------------------------------------------------
    // Amend dan jaring pengaman legacy (putaran perbaikan review)
    // ---------------------------------------------------------------------------------------------------------

    public function test_amending_a_sales_invoice_copies_every_tax_line_and_the_revision_posts_a_balanced_journal(): void {
        $ppn = $this->ppn();
        $pph = $this->pph();

        $original = $this->approveSales($this->createSalesInvoice([
            ['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000],
            ['taxes' => [$ppn->getKey()], 'price' => 500_000],
        ]));
        $revision = $original->fresh()->amend();

        $this->assertNotSame($original->id, $revision->id);
        $revisionItems = $revision->items()->orderBy('created_at')->orderBy('id')->get();
        $this->assertCount(2, $revisionItems);

        $twoTax = $revisionItems->first(fn ($item): bool => $item->taxLines()->count() === 2);
        $this->assertNotNull($twoTax, 'Item dengan PPN + PPh tetap punya dua baris pivot di revisi.');
        $this->assertSame([$ppn->getKey(), $pph->getKey()], $twoTax->taxLines()->get()->pluck('tax_id')->all(), 'Urutan position tersalin.');
        foreach ($revisionItems as $item) {
            $this->assertItemAggregatesMatchPivot($item);
        }
        $this->assertEqualsWithDelta($original->items->sum('tax_amount'), $revisionItems->sum('tax_amount'), 0.001);
        $this->assertEqualsWithDelta($original->items->sum('withholding_amount'), $revisionItems->sum('withholding_amount'), 0.001);

        $approved = $this->approveSales($revision->fresh());
        $this->assertBalanced($this->journalOf($approved->id));
        foreach ($approved->items as $item) {
            $this->assertItemAggregatesMatchPivot($item);
        }
    }

    public function test_amending_a_purchase_invoice_copies_every_tax_line(): void {
        $ppn = $this->ppn();
        $pph = $this->pph();

        $original = $this->approvePurchase($this->createPurchaseInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]));
        $revision = $original->fresh()->amend();

        $item = $revision->items()->firstOrFail();
        $this->assertSame([$ppn->getKey(), $pph->getKey()], $item->taxLines()->get()->pluck('tax_id')->all());
        $this->assertItemAggregatesMatchPivot($item);

        $approved = $this->approvePurchase($revision->fresh());
        $this->assertBalanced($this->journalOf($approved->id));
    }

    public function test_the_legacy_amount_hook_does_not_recompute_an_item_with_more_than_one_tax_line(): void {
        $ppn = $this->ppn();
        $pph = $this->pph();

        $invoice = $this->createSalesInvoice([['taxes' => [$ppn->getKey(), $pph->getKey()], 'price' => 1_000_000]]);
        $item    = $invoice->items()->firstOrFail();
        $before  = [(float) $item->tax_amount, (float) $item->withholding_amount, (float) $item->dpp_amount];
        $this->assertGreaterThan(0, $before[1]);

        // Penulis lama mengubah masukan tanpa lewat calculator: agregat majemuk tidak boleh tertimpa angka satu pajak.
        $item->update(['discount_amount' => 0, 'tax_rate' => $item->tax_rate + 0.0001]);

        $fresh = $item->fresh();
        $this->assertEqualsWithDelta($before[0], (float) $fresh->tax_amount, 0.0001);
        $this->assertEqualsWithDelta($before[1], (float) $fresh->withholding_amount, 0.0001);
        $this->assertEqualsWithDelta($before[2], (float) $fresh->dpp_amount, 0.0001);
    }

    private function versionOf(Tax $tax): TaxRuleVersion {
        return TaxRuleVersion::query()->where('tax_id', $tax->getKey())->where('status', TaxRuleVersion::STATUS_ACTIVE)->firstOrFail();
    }
}
