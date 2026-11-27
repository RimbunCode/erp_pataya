<?php

namespace Tests\Feature\Finances\Tax;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
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
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Accounting\PurchaseInvoicePanelSource;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Tax\TaxRuleVersionService;
use App\Services\Sales\Accounting\SalesInvoicePanelSource;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 6.2-6.3 dan 6.5 (Requirement 7.1-7.6, 7.9, 8.2): pemisahan baris pajak pada jurnal Sales Invoice
 * dan Purchase Invoice lewat engine posting, golden G1-G5. Jurnal selalu seimbang, baris `revenue`/`expense` adalah sisa,
 * setiap baris pajak membawa `tax_rule_version_id`, dan bentuk lama dipertahankan bila pra-cutover atau komponen tak
 * dapat dipisah.
 */
class TaxJournalSplitTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $payable;
    private Account $expense;
    private Account $srnb;
    private Account $taxOutput;
    private Account $taxInput;
    private Account $discountSales;
    private Account $discountPurchase;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);

        $this->receivable       = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue          = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->payable          = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->expense          = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->srnb             = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->taxOutput        = $this->makeAccount('2300', 'PPN Keluaran', 'liability', 'credit');
        $this->taxInput         = $this->makeAccount('1300', 'PPN Masukan', 'asset', 'debit');
        $this->discountSales    = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
        $this->discountPurchase = $this->makeAccount('5900', 'Potongan Pembelian', 'expense', 'credit');

        $this->activateProfile(withTaxRoles: true);

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-TAXSPLIT-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    private function activateProfile(bool $withTaxRoles): void {
        $roles = [
            'receivable'                    => $this->receivable->id,
            'revenue'                       => $this->revenue->id,
            'payable'                       => $this->payable->id,
            'expense'                       => $this->expense->id,
            'stock_received_but_not_billed' => $this->srnb->id,
            'discount'                      => $this->discountSales->id,
        ];
        if ($withTaxRoles) {
            $roles['tax_output'] = $this->taxOutput->id;
            $roles['tax_input']  = $this->taxInput->id;
        }

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil tes pajak', '2020-01-01', null, $roles, [['role' => 'discount', 'account_id' => $this->discountPurchase->id, 'document_type' => 'purchase_invoice']]));
    }

    private function setCutover(?string $date, ?string $purchaseDate = null): void {
        $today = CarbonImmutable::parse(app(FiscalPeriodService::class)->businessDay(now()))->toDateString();
        app(SettingsService::class)->updateInternal(FinanceSetting::class, [
            'tax_split_from' => [
                'sales_invoice'    => $date === 'today' ? $today : $date,
                'purchase_invoice' => ($purchaseDate ?? $date) === 'today' ? $today : ($purchaseDate ?? $date),
            ],
        ]);
    }

    private function ppn(string $name = 'PPN 12', float $rate = 12, string $category = Tax::CATEGORY_PPN_STANDARD, bool $creditable = true): Tax {
        $tax = Tax::query()->create(['name' => $name, 'rate' => $rate, 'category' => $category, 'is_creditable' => $creditable]);
        app(TaxRuleVersionService::class)->createInitialVersion($tax);

        return $tax->fresh();
    }

    private function versionOf(Tax $tax): TaxRuleVersion {
        return TaxRuleVersion::query()->where('tax_id', $tax->getKey())->where('status', TaxRuleVersion::STATUS_ACTIVE)->firstOrFail();
    }

    /**
     * @param  list<array{tax: Tax, price: float, quantity?: float, discount?: float}>  $rows
     * @param  array<string, mixed>  $attributes
     */
    private function salesInvoice(array $rows, array $attributes = []): SalesInvoice {
        $invoice = SalesInvoice::factory()->create([
            'date'      => now()->subDay(),
            'branch_id' => $this->branch->id,
            'status'    => [FormStatus::SUBMITTED],
            ...$attributes,
        ]);
        foreach ($rows as $row) {
            SalesInvoiceItem::factory()->create([
                'sales_invoice_id'    => $invoice->id,
                'quantity'            => $row['quantity'] ?? 1,
                'price'               => $row['price'],
                'discount_amount'     => $row['discount'] ?? 0,
                'tax_id'              => $row['tax']->getKey(),
                'tax_rate'            => $row['tax']->rate,
                'tax_rule_version_id' => $this->versionOf($row['tax'])->getKey(),
            ]);
        }
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        return $invoice->fresh();
    }

    /**
     * @param  list<array{tax: Tax, rate: float, quantity?: float, discount?: float, stock?: bool}>  $rows
     * @param  array<string, mixed>  $attributes
     */
    private function purchaseInvoice(array $rows, array $attributes = []): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'              => now()->subDays(3),
            'purchase_order_id' => $this->purchaseOrder->id,
            ...$attributes,
            'branch_id' => $this->branch->id,
            'status'    => [FormStatus::SUBMITTED],
        ]);
        foreach ($rows as $row) {
            PurchaseInvoiceItem::create([
                'purchase_invoice_id' => $invoice->id,
                'item_id'             => ItemVariant::factory()->create(['is_stock_item' => $row['stock'] ?? false])->id,
                'quantity'            => $row['quantity'] ?? 1,
                'rate'                => $row['rate'],
                'discount_amount'     => $row['discount'] ?? 0,
                'tax_id'              => $row['tax']->getKey(),
                'tax_rate'            => $row['tax']->rate,
                'tax_rule_version_id' => $this->versionOf($row['tax'])->getKey(),
            ]);
        }
        GlPostingStatus::create(['referenceable_type' => PurchaseInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        return $invoice->fresh();
    }

    private function total(SalesInvoice|PurchaseInvoice $invoice): float {
        return (float) $invoice->items()->get()->sum(fn ($item): float => (float) $item->basic_amount - (float) $item->discount_amount + (float) $item->tax_amount);
    }

    private function postSales(SalesInvoice $invoice, bool $isReturn = false): void {
        (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, $this->total($invoice), $isReturn, now(), null, null));
    }

    private function postPurchase(PurchaseInvoice $invoice, bool $isReturn = false): void {
        (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested($invoice, 0.0, $this->total($invoice), $isReturn, now(), null, null));
    }

    /**
     * Jurnal `purpose` tertentu sebagai peta `"{sisi}:{akun}"` => jumlah (baris pajak dengan versi dipisah per versi).
     *
     * @return array<string, float>
     */
    private function journalOf(string $invoiceId, ?string $purposeSuffix = null): array {
        $journals = Journal::query()->where('source_id', $invoiceId)->get()
            ->filter(fn (Journal $journal): bool => $purposeSuffix === null || str_ends_with((string) $journal->posting_key, ':' . $purposeSuffix));
        $lines = GeneralLedger::query()->whereIn('journal_id', $journals->pluck('id'))->get();

        $map = [];
        foreach ($lines as $line) {
            $side      = (float) $line->debit > 0 ? 'D' : 'C';
            $key       = $side . ':' . $line->account_id . ($line->tax_rule_version_id !== null ? ':' . $line->tax_rule_version_id : '');
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

    public function test_g1_sales_invoice_splits_output_vat_and_revenue_is_the_remainder(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $version = $this->versionOf($tax);
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);

        $this->postSales($invoice);

        $journal = $this->journalOf($invoice->id);
        $this->assertEqualsWithDelta(13_320_000, $journal['D:' . $this->receivable->id], 0.01);
        $this->assertEqualsWithDelta(12_000_000, $journal['C:' . $this->revenue->id], 0.01, 'Pendapatan = total - PPN (sisa).');
        $this->assertEqualsWithDelta(1_320_000, $journal['C:' . $this->taxOutput->id . ':' . $version->getKey()], 0.01);
        $this->assertBalanced($journal);
        $this->assertSame($version->getKey(), GeneralLedger::query()->where('account_id', $this->taxOutput->id)->value('tax_rule_version_id'));
        $this->assertNull(GeneralLedger::query()->where('account_id', $this->revenue->id)->value('tax_rule_version_id'));
    }

    public function test_g2_invoices_with_different_rule_versions_carry_their_own_version_id(): void {
        $this->setCutover('today');
        $tax = $this->ppn('PPN bertahap', 11);
        $v1  = $this->versionOf($tax);
        $v2  = app(TaxRuleVersionService::class)->activate(app(TaxRuleVersionService::class)->createNewVersion($v1, '2026-07-01', null, ['rate' => 12]));

        $old = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $new = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $new->items()->update(['tax_rule_version_id' => $v2->getKey(), 'tax_rate' => 12]);

        $this->postSales($old->fresh());
        $this->postSales($new->fresh());

        $oldJournal = $this->journalOf($old->id);
        $newJournal = $this->journalOf($new->id);
        $this->assertEqualsWithDelta(1_210_000, $oldJournal['C:' . $this->taxOutput->id . ':' . $v1->getKey()], 0.01, '11% x 11/12 x 12jt.');
        $this->assertEqualsWithDelta(1_320_000, $newJournal['C:' . $this->taxOutput->id . ':' . $v2->getKey()], 0.01);
    }

    public function test_g3_two_lines_with_different_rates_group_components_per_version(): void {
        $this->setCutover('today');
        $five    = $this->ppn('PPN 5', 5);
        $twelve  = $this->ppn('PPN 12', 12);
        $invoice = $this->salesInvoice([['tax' => $five, 'price' => 5_000_000], ['tax' => $twelve, 'price' => 7_000_000]]);

        $this->postSales($invoice);

        $journal   = $this->journalOf($invoice->id);
        $taxFive   = 5_000_000 * 11 / 12 * 0.05;
        $taxTwelve = 7_000_000 * 11 / 12 * 0.12;
        $this->assertEqualsWithDelta($taxFive, $journal['C:' . $this->taxOutput->id . ':' . $this->versionOf($five)->getKey()], 0.01);
        $this->assertEqualsWithDelta($taxTwelve, $journal['C:' . $this->taxOutput->id . ':' . $this->versionOf($twelve)->getKey()], 0.01);
        $this->assertEqualsWithDelta(12_000_000, $journal['C:' . $this->revenue->id], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_g4_unclassified_tax_keeps_the_legacy_two_line_journal_and_is_logged(): void {
        Log::spy();
        $this->setCutover('today');
        $tax     = $this->ppn('PPN lama', 11, Tax::CATEGORY_UNCLASSIFIED);
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 10_000_000]]);

        $this->postSales($invoice);

        $journal = $this->journalOf($invoice->id);
        $this->assertCount(2, $journal, 'P-6: unclassified tidak dipisah.');
        $this->assertEqualsWithDelta($this->total($invoice), $journal['C:' . $this->revenue->id], 0.01);
        $this->assertArrayNotHasKey('C:' . $this->taxOutput->id, $journal);
        Log::shouldHaveReceived('info')->withArgs(fn (string $message, array $context) => $message === 'posting.unsplit_tax' && $context['reason'] === 'unclassified_or_withholding')->once();
    }

    public function test_g5_sales_return_swaps_every_side(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $version = $this->versionOf($tax);
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);

        $this->postSales($invoice, isReturn: true);

        $journal = $this->journalOf($invoice->id);
        $this->assertEqualsWithDelta(13_320_000, $journal['C:' . $this->receivable->id], 0.01);
        $this->assertEqualsWithDelta(12_000_000, $journal['D:' . $this->revenue->id], 0.01);
        $this->assertEqualsWithDelta(1_320_000, $journal['D:' . $this->taxOutput->id . ':' . $version->getKey()], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_g6_fractional_amounts_stay_balanced_and_the_remainder_absorbs_rounding(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 1001.37, 'quantity' => 3]]);

        $this->postSales($invoice);

        $journal = $this->journalOf($invoice->id);
        $this->assertBalanced($journal);
        $storedTax = (float) $invoice->items()->sum('tax_amount');
        $this->assertEqualsWithDelta($storedTax, $journal['C:' . $this->taxOutput->id . ':' . $this->versionOf($tax)->getKey()], 0.01, 'P-1: pajak jurnal = pajak tersimpan (toleransi satu minor unit).');
    }

    public function test_before_the_cutover_the_legacy_form_is_kept(): void {
        $this->setCutover(now()->addDays(10)->toDateString());
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);

        $this->postSales($invoice);

        $journal = $this->journalOf($invoice->id);
        $this->assertCount(2, $journal);
        $this->assertEqualsWithDelta(13_320_000, $journal['C:' . $this->revenue->id], 0.01);
    }

    public function test_an_empty_cutover_means_inactive_and_does_not_need_the_tax_roles(): void {
        $this->setCutover(null);
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);

        $this->postSales($invoice);

        $this->assertCount(2, $this->journalOf($invoice->id));
    }

    public function test_unmapped_tax_role_after_the_cutover_fails_closed(): void {
        DB::table('posting_profile_accounts')->whereIn('role', ['tax_output', 'tax_input'])->delete();
        $this->setCutover('today');
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);

        $this->expectException(UnresolvedAccountRoleException::class);

        $this->postSales($invoice);
    }

    public function test_purchase_invoice_splits_creditable_input_vat(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $version = $this->versionOf($tax);
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);

        $this->postPurchase($invoice);

        $journal = $this->journalOf($invoice->id, 'expense');
        $this->assertEqualsWithDelta(11_100_000, $journal['C:' . $this->payable->id], 0.01);
        $this->assertEqualsWithDelta(10_000_000, $journal['D:' . $this->expense->id], 0.01);
        $this->assertEqualsWithDelta(1_100_000, $journal['D:' . $this->taxInput->id . ':' . $version->getKey()], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_purchase_return_swaps_every_side(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);

        $this->postPurchase($invoice, isReturn: true);

        $journal = $this->journalOf($invoice->id, 'expense');
        $this->assertEqualsWithDelta(11_100_000, $journal['D:' . $this->payable->id], 0.01);
        $this->assertEqualsWithDelta(10_000_000, $journal['C:' . $this->expense->id], 0.01);
        $this->assertEqualsWithDelta(1_100_000, $journal['C:' . $this->taxInput->id . ':' . $this->versionOf($tax)->getKey()], 0.01);
    }

    public function test_non_creditable_input_vat_stays_embedded_in_the_expense(): void {
        Log::spy();
        $this->setCutover('today');
        $tax     = $this->ppn('PPN tak kredit', 12, Tax::CATEGORY_PPN_STANDARD, creditable: false);
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);

        $this->postPurchase($invoice);

        $journal = $this->journalOf($invoice->id, 'expense');
        $this->assertCount(2, $journal);
        $this->assertEqualsWithDelta(11_100_000, $journal['D:' . $this->expense->id], 0.01);
        Log::shouldHaveReceived('info')->withArgs(fn (string $message, array $context) => $message === 'posting.unsplit_tax' && $context['reason'] === 'not_creditable')->once();
    }

    public function test_a_non_pkp_company_embeds_input_vat(): void {
        $this->setCutover('today');
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['company_is_pkp' => false]);
        $tax     = $this->ppn();
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);

        $this->postPurchase($invoice);

        $journal = $this->journalOf($invoice->id, 'expense');
        $this->assertCount(2, $journal);
        $this->assertEqualsWithDelta(11_100_000, $journal['D:' . $this->expense->id], 0.01);
    }

    public function test_reversal_keeps_the_tax_rule_version_of_the_original_lines(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $version = $this->versionOf($tax);
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $this->postSales($invoice);

        $journal  = Journal::query()->where('source_id', $invoice->id)->firstOrFail();
        $reversal = app(JournalReversalService::class)->reverse($journal);

        $reversed = GeneralLedger::query()->where('journal_id', $reversal->id)->where('account_id', $this->taxOutput->id)->firstOrFail();
        $this->assertSame($version->getKey(), $reversed->tax_rule_version_id);
        $this->assertEqualsWithDelta(1_320_000, (float) $reversed->debit, 0.01, 'Pembalik menukar sisi apa adanya.');
    }

    public function test_a_pre_cutover_journal_is_reversed_in_its_legacy_form(): void {
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $this->postSales($invoice);
        $this->setCutover('today');

        $journal  = Journal::query()->where('source_id', $invoice->id)->firstOrFail();
        $reversal = app(JournalReversalService::class)->reverse($journal);

        $lines = GeneralLedger::query()->where('journal_id', $reversal->id)->get();
        $this->assertCount(2, $lines);
        $this->assertNull($lines->first()->tax_rule_version_id);
    }

    /**
     * Retur mengikuti bentuk jurnal invoice ASAL (keputusan pemilik produk 27 November 2026, selaras Q-P2-25).
     */
    public function test_sales_return_against_a_pre_cutover_invoice_stays_embedded_even_after_the_cutover(): void {
        $tax    = $this->ppn();
        $origin = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $this->postSales($origin);
        $this->setCutover('today');

        $return = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]], ['return_against_id' => $origin->id]);
        $this->postSales($return, isReturn: true);

        $journal = $this->journalOf($return->id);
        $this->assertCount(2, $journal, 'Retur atas invoice pra-cutover tetap tertanam.');
        $this->assertEqualsWithDelta(13_320_000, $journal['D:' . $this->revenue->id], 0.01);
        $this->assertSame(0, GeneralLedger::query()->whereNotNull('tax_rule_version_id')->count());
    }

    public function test_sales_return_against_a_post_cutover_invoice_stays_split_even_if_the_cutover_is_removed(): void {
        $this->setCutover('today');
        $tax     = $this->ppn();
        $version = $this->versionOf($tax);
        $origin  = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]]);
        $this->postSales($origin);
        $this->setCutover(now()->addDays(30)->toDateString());

        $return = $this->salesInvoice([['tax' => $tax, 'price' => 12_000_000]], ['return_against_id' => $origin->id]);
        $this->postSales($return, isReturn: true);

        $journal = $this->journalOf($return->id);
        $this->assertEqualsWithDelta(1_320_000, $journal['D:' . $this->taxOutput->id . ':' . $version->getKey()], 0.01, 'Saldo tax_output tidak boleh debit tanpa kredit asal.');
        $this->assertEqualsWithDelta(12_000_000, $journal['D:' . $this->revenue->id], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_purchase_return_follows_the_form_of_the_origin_invoice(): void {
        $tax    = $this->ppn();
        $before = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);
        $this->postPurchase($before);
        $this->setCutover('today');
        $after = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);
        $this->postPurchase($after);

        $returnBefore = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]], ['return_against_id' => $before->id]);
        $this->postPurchase($returnBefore, isReturn: true);
        $returnAfter = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]], ['return_against_id' => $after->id]);
        $this->postPurchase($returnAfter, isReturn: true);

        $embedded = $this->journalOf($returnBefore->id, 'expense');
        $this->assertCount(2, $embedded, 'Retur atas PI pra-cutover tetap tertanam.');
        $this->assertEqualsWithDelta(11_100_000, $embedded['C:' . $this->expense->id], 0.01);

        $split = $this->journalOf($returnAfter->id, 'expense');
        $this->assertEqualsWithDelta(1_100_000, $split['C:' . $this->taxInput->id . ':' . $this->versionOf($tax)->getKey()], 0.01);
        $this->assertEqualsWithDelta(10_000_000, $split['C:' . $this->expense->id], 0.01);
        $this->assertBalanced($split);
    }

    private function setDiscountCutoverToday(): void {
        $today = app(FiscalPeriodService::class)->businessDay(now());
        app(SettingsService::class)->update(FinanceSetting::class, [
            FinanceSetting::DISCOUNT_SPLIT_COLUMNS['sales_invoice']    => $today,
            FinanceSetting::DISCOUNT_SPLIT_COLUMNS['purchase_invoice'] => $today,
        ]);
    }

    public function test_sales_invoice_with_split_discount_and_split_tax_is_balanced(): void {
        $this->setCutover('today');
        $this->setDiscountCutoverToday();
        $tax     = $this->ppn();
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 6_000_000, 'quantity' => 2, 'discount' => 500_000]]);

        $this->postSales($invoice);

        $items    = $invoice->items()->get();
        $basic    = (float) $items->sum('basic_amount');
        $storedTx = (float) $items->sum('tax_amount');
        $journal  = $this->journalOf($invoice->id);
        $this->assertEqualsWithDelta($basic - 500_000 + $storedTx, $journal['D:' . $this->receivable->id], 0.01);
        $this->assertEqualsWithDelta(500_000, $journal['D:' . $this->discountSales->id], 0.01);
        $this->assertEqualsWithDelta($basic, $journal['C:' . $this->revenue->id], 0.01, 'Pendapatan kotor tanpa pajak.');
        $this->assertEqualsWithDelta($storedTx, $journal['C:' . $this->taxOutput->id . ':' . $this->versionOf($tax)->getKey()], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_purchase_invoice_with_split_discount_and_split_tax_is_balanced(): void {
        $this->setCutover('today');
        $this->setDiscountCutoverToday();
        $tax     = $this->ppn();
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 6_000_000, 'quantity' => 2, 'discount' => 500_000]]);

        $this->postPurchase($invoice);

        $items    = $invoice->items()->get();
        $basic    = (float) $items->sum('basic_amount');
        $storedTx = (float) $items->sum('tax_amount');
        $journal  = $this->journalOf($invoice->id, 'expense');
        $this->assertEqualsWithDelta($basic - 500_000 + $storedTx, $journal['C:' . $this->payable->id], 0.01);
        $this->assertEqualsWithDelta(500_000, $journal['C:' . $this->discountPurchase->id], 0.01);
        $this->assertEqualsWithDelta($basic, $journal['D:' . $this->expense->id], 0.01);
        $this->assertEqualsWithDelta($storedTx, $journal['D:' . $this->taxInput->id . ':' . $this->versionOf($tax)->getKey()], 0.01);
        $this->assertBalanced($journal);
    }

    public function test_purchase_invoice_with_a_stock_line_and_tax_keeps_tax_exact_and_balanced_under_discount_split(): void {
        $this->setCutover('today');
        $this->setDiscountCutoverToday();
        $tax     = $this->ppn();
        $invoice = $this->purchaseInvoice([
            ['tax' => $tax, 'rate' => 1001.37, 'quantity' => 3, 'discount' => 100.11, 'stock' => true],
            ['tax' => $tax, 'rate' => 777.77, 'quantity' => 7, 'discount' => 33.33],
        ]);

        $this->postPurchase($invoice);

        $journal  = $this->journalOf($invoice->id, 'expense');
        $storedTx = (float) $invoice->items()->sum('tax_amount');
        $this->assertBalanced($journal);
        $this->assertEqualsWithDelta($storedTx, $journal['D:' . $this->taxInput->id . ':' . $this->versionOf($tax)->getKey()], 0.01, 'Baris pajak tidak menyerap pembulatan (selisih paling satu minor unit dari nilai tersimpan).');
        $this->assertEqualsWithDelta($this->total($invoice), $journal['C:' . $this->payable->id], 0.01, 'Utang = total dokumen (dibulatkan ke minor unit).');
    }

    public function test_the_draft_panel_preview_does_not_log_unsplit_tax_but_real_posting_does(): void {
        Log::spy();
        $this->setCutover('today');
        $tax     = $this->ppn('PPN lama', 11, Tax::CATEGORY_UNCLASSIFIED);
        $invoice = $this->salesInvoice([['tax' => $tax, 'price' => 10_000_000]]);

        $context = app(SalesInvoicePanelSource::class)->previewContext($invoice);

        $this->assertNotNull($context);
        Log::shouldNotHaveReceived('info', fn (string $message) => $message === 'posting.unsplit_tax');

        $this->postSales($invoice);
        Log::shouldHaveReceived('info')->withArgs(fn (string $message) => $message === 'posting.unsplit_tax')->once();
    }

    public function test_the_purchase_draft_panel_preview_does_not_log_unsplit_tax(): void {
        Log::spy();
        $this->setCutover('today');
        $tax     = $this->ppn('PPN tak kredit', 12, Tax::CATEGORY_PPN_STANDARD, creditable: false);
        $invoice = $this->purchaseInvoice([['tax' => $tax, 'rate' => 10_000_000]]);

        $context = app(PurchaseInvoicePanelSource::class)->previewContext($invoice);

        $this->assertNotNull($context);
        Log::shouldNotHaveReceived('info', fn (string $message) => $message === 'posting.unsplit_tax');

        $this->postPurchase($invoice);
        Log::shouldHaveReceived('info')->withArgs(fn (string $message) => $message === 'posting.unsplit_tax')->once();
    }

    public function test_the_tax_split_flag_is_only_for_the_two_invoice_types(): void {
        $this->assertSame(['sales_invoice', 'purchase_invoice'], FinanceSetting::TAX_SPLIT_DOCUMENT_TYPES);
        $this->assertSame(PostingDocumentType::SalesInvoice->value, FinanceSetting::TAX_SPLIT_DOCUMENT_TYPES[0]);
    }
}
