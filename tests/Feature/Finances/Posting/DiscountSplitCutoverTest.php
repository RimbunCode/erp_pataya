<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Sales\Accounting\SalesInvoicePostingContextFactory;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.1-13.3 (Requirement 14.1, 14.2, 14.3): tanggal cutover `finance_discount_split_from.*`
 * menentukan bentuk jurnal invoice lewat service/listener sungguhan. Sebelum cutover (atau setting kosong) jurnal
 * tetap bersih; pada dan sesudah cutover berbentuk diskon terpisah; jurnal yang sudah terposting tidak berubah.
 * Engine selalu aktif (Q-P2-23, 22 November 2026), jadi tidak ada lagi mode `off`/`shadow` dan alasan parity
 * `discount_split` (Requirement 14.6 gugur).
 *
 * Fixture: item Sales Invoice 2 x 1.000, pajak 10% (DPP 11/12), diskon 200 -> DPP 1.650, pajak 165, bersih 1.965,
 * kotor 2.165.
 */
class DiscountSplitCutoverTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $payable;
    private Account $srnb;
    private Account $discountSales;
    private Account $discountPurchase;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);

        $this->receivable       = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue          = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->payable          = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->srnb             = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->discountSales    = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
        $this->discountPurchase = $this->makeAccount('5900', 'Potongan Pembelian', 'expense', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil diskon', '2020-01-01', null, [
            'receivable'                    => $this->receivable->id,
            'revenue'                       => $this->revenue->id,
            'payable'                       => $this->payable->id,
            'expense'                       => $this->srnb->id,
            'stock_received_but_not_billed' => $this->srnb->id,
            'discount'                      => $this->discountSales->id,
        ], [
            ['role' => 'discount', 'account_id' => $this->discountPurchase->id, 'document_type' => 'purchase_invoice'],
        ]));

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-DISC-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    private function businessToday(): CarbonImmutable {
        return CarbonImmutable::parse(app(FiscalPeriodService::class)->businessDay(now()));
    }

    private function setCutover(PostingDocumentType $type, ?string $date): void {
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[$type->value] => $date]);
    }

    private function approveSalesInvoice(float $discount = 200): SalesInvoice {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['discount_amount' => $discount]);
        app(SalesInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    private function approvePurchaseInvoice(bool $stockItem, float $discount = 200): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->srnb->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->purchaseOrder->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create(['is_stock_item' => $stockItem])->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_rate'            => 10,
            'discount_amount'     => $discount,
        ]);
        app(PurchaseInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    /**
     * Baris jurnal `default`/`expense` sebagai peta nomor akun => [debit, kredit].
     *
     * @param  array<string, array{date: string, lines: list<array{0: string, 1: float, 2: float}>}>  $signature
     * @return array<string, array{0: float, 1: float}>
     */
    private function linesOf(array $signature, string $purpose): array {
        $result = [];
        foreach ($signature[$purpose]['lines'] as [$account, $debit, $credit]) {
            $result[$account] = [$debit, $credit];
        }
        ksort($result);

        return $result;
    }

    private function assertNetShape(SalesInvoice $invoice): void {
        $this->assertEqualsWithDelta(1965.0, (float) $invoice->amount, 1e-6);
        $this->assertSame(
            ['1200' => [1965.0, 0.0], '4000' => [0.0, 1965.0]],
            $this->linesOf($this->journalSignature($invoice), 'default'),
        );
    }

    private function assertSplitShape(SalesInvoice $invoice): void {
        $this->assertEqualsWithDelta(1965.0, (float) $invoice->amount, 1e-6);
        $this->assertSame(
            ['1200' => [1965.0, 0.0], '4000' => [0.0, 2165.0], '4900' => [200.0, 0.0]],
            $this->linesOf($this->journalSignature($invoice), 'default'),
        );
    }

    public function test_sales_invoice_splits_only_from_the_cutover_date(): void {
        $today = $this->businessToday();

        // Setting kosong (default): jurnal bersih.
        $this->assertNetShape($this->approveSalesInvoice());

        // Cutover besok: dokumen hari ini masih sebelum cutover -> bersih.
        $this->setCutover(PostingDocumentType::SalesInvoice, $today->addDay()->toDateString());
        $this->assertNetShape($this->approveSalesInvoice());

        // Cutover hari ini (batas "pada tanggal itu"): split.
        $this->setCutover(PostingDocumentType::SalesInvoice, $today->toDateString());
        $this->assertSplitShape($this->approveSalesInvoice());

        // Cutover kemarin: split.
        $this->setCutover(PostingDocumentType::SalesInvoice, $today->subDay()->toDateString());
        $this->assertSplitShape($this->approveSalesInvoice());

        // Dokumen tanpa diskon tetap berbentuk bersih walau cutover aktif.
        $noDiscount = $this->approveSalesInvoice(0);
        $this->assertSame(
            ['1200' => [2183.33, 0.0], '4000' => [0.0, 2183.33]],
            $this->linesOf($this->journalSignature($noDiscount), 'default'),
        );

        // Mengosongkan setting kembali ke bentuk bersih untuk dokumen berikutnya.
        $this->setCutover(PostingDocumentType::SalesInvoice, null);
        $this->assertNetShape($this->approveSalesInvoice());
    }

    public function test_the_sales_cutover_does_not_affect_purchase_invoice_and_vice_versa(): void {
        $this->setCutover(PostingDocumentType::PurchaseInvoice, $this->businessToday()->toDateString());

        $this->assertNetShape($this->approveSalesInvoice());
    }

    public function test_documents_posted_before_the_cutover_are_not_changed_or_reposted(): void {
        $invoice = $this->approveSalesInvoice();
        $before  = $this->journalSignature($invoice);
        $this->assertNetShape($invoice);
        $journals = Journal::query()->count();

        $this->setCutover(PostingDocumentType::SalesInvoice, $this->businessToday()->toDateString());

        // Percobaan ulang listener atas dokumen yang sama (mis. job dicoba ulang): idempoten, jurnal lama tidak berubah.
        GlPostingStatus::query()->where('referenceable_id', $invoice->id)->update(['status' => FormStatus::PENDING->value]);
        (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, (float) $invoice->amount, false, now(), $this->receivable->id, $this->revenue->id));

        $this->assertSame($before, $this->journalSignature($invoice));
        $this->assertSame($journals, Journal::query()->count());
    }

    public function test_purchase_invoice_non_stock_line_splits_with_a_credit_discount_from_the_cutover(): void {
        $net = $this->approvePurchaseInvoice(stockItem: false);
        $this->assertSame(
            ['2000' => [0.0, 1965.0], '2100' => [1965.0, 0.0]],
            $this->linesOf($this->journalSignature($net), 'expense'),
        );

        $this->setCutover(PostingDocumentType::PurchaseInvoice, $this->businessToday()->toDateString());

        $split = $this->approvePurchaseInvoice(stockItem: false);
        $this->assertSame(
            ['2000' => [0.0, 1965.0], '2100' => [2165.0, 0.0], '5900' => [0.0, 200.0]],
            $this->linesOf($this->journalSignature($split), 'expense'),
        );
    }

    public function test_purchase_invoice_stock_line_stays_net_after_the_cutover(): void {
        $this->setCutover(PostingDocumentType::PurchaseInvoice, $this->businessToday()->toDateString());

        $stock = $this->approvePurchaseInvoice(stockItem: true);

        $this->assertSame(
            ['2000' => [0.0, 1965.0], '2100' => [1965.0, 0.0]],
            $this->linesOf($this->journalSignature($stock), 'expense'),
            'baris stok tetap bersih (Q-P2-5)',
        );
    }

    public function test_purchase_invoice_mixing_stock_and_non_stock_lines_splits_only_the_non_stock_discount(): void {
        $this->setCutover(PostingDocumentType::PurchaseInvoice, $this->businessToday()->toDateString());

        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->srnb->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->purchaseOrder->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
        ]);
        // Dua baris sama (2 x 1.000, pajak 10%, diskon 200 -> bersih 1.965, kotor 2.165): satu stok, satu non-stok.
        foreach ([true, false] as $stockItem) {
            PurchaseInvoiceItem::create([
                'purchase_invoice_id' => $invoice->id,
                'item_id'             => ItemVariant::factory()->create(['is_stock_item' => $stockItem])->id,
                'quantity'            => 2,
                'rate'                => 1000,
                'tax_rate'            => 10,
                'discount_amount'     => 200,
            ]);
        }
        app(PurchaseInvoiceService::class)->onApproved($invoice);

        // Beban = bersih baris stok (1.965) + kotor baris non-stok (2.165); diskon hanya milik baris non-stok (200);
        // utang = total bersih kedua baris (3.930).
        $this->assertSame(
            ['2000' => [0.0, 3930.0], '2100' => [4130.0, 0.0], '5900' => [0.0, 200.0]],
            $this->linesOf($this->journalSignature($invoice->fresh()), 'expense'),
        );
    }

    public function test_sales_invoice_return_after_the_cutover_swaps_every_side_of_the_split_journal(): void {
        $this->setCutover(PostingDocumentType::SalesInvoice, $this->businessToday()->toDateString());

        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['discount_amount' => 200]);
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        // Retur lewat listener sungguhan (event `isReturn` = true), seperti `SalesInvoiceService::onApproved()` untuk retur.
        (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, 1965.0, true, now(), $this->receivable->id, $this->revenue->id));

        $this->assertSame(
            ['1200' => [0.0, 1965.0], '4000' => [2165.0, 0.0], '4900' => [0.0, 200.0]],
            $this->linesOf($this->journalSignature($invoice), 'default'),
            'piutang dikredit sebesar bersih, pendapatan kotor didebit, diskon dikredit',
        );
    }

    public function test_context_factory_does_not_split_when_the_line_total_is_inconsistent(): void {
        $this->setCutover(PostingDocumentType::SalesInvoice, $this->businessToday()->toDateString());
        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['discount_amount' => 200]);

        $consistent   = app(SalesInvoicePostingContextFactory::class)->forPosting($invoice, 1965.0, false, now());
        $inconsistent = app(SalesInvoicePostingContextFactory::class)->forPosting($invoice, 5000.0, false, now());

        $this->assertTrue($consistent->flag('discount_split'));
        $this->assertEqualsWithDelta(200.0, $consistent->amount('discount_amount'), 1e-6);
        $this->assertEqualsWithDelta(2165.0, $consistent->amount('gross_amount'), 1e-6);
        $this->assertFalse($inconsistent->flag('discount_split'), 'lines dikosongkan builder -> jurnal tetap bersih');
        $this->assertSame([], $inconsistent->lines);
    }

    public function test_context_factory_amounts_use_item_discount_not_the_header_discount(): void {
        $this->setCutover(PostingDocumentType::SalesInvoice, $this->businessToday()->toDateString());
        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, ['discount_on' => 'grand_total', 'discount_amount' => 999], ['discount_amount' => 200]);

        $ctx = app(SalesInvoicePostingContextFactory::class)->forPosting($invoice, 1965.0, false, now());

        $this->assertEqualsWithDelta(200.0, $ctx->amount('discount_amount'), 1e-6, 'bukan header 999');
    }
}
