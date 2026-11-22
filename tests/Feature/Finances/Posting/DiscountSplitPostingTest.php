<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\MinorUnit;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Posting\PostingService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\GeneratesDiscountedInvoiceAmounts;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.3 (P-13, Requirement 14.2-14.3): posting diskon terpisah lewat `PostingService` pada minor
 * unit 0 dan 2. Jurnal tetap seimbang SETELAH pembulatan dan jumlah akun `receivable`/`payable` tetap sama dengan total
 * bersih dokumen (bukti perbaikan `absorbRounding`: sisa pembulatan tidak boleh menggeser piutang/utang). Akun `discount`
 * Sales Invoice dan Purchase Invoice dapat berbeda lewat aturan akun bersyarat `document_type`.
 */
class DiscountSplitPostingTest extends TestCase {
    use BuildsFinanceFixtures, GeneratesDiscountedInvoiceAmounts, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $payable;
    private Account $expense;
    private Account $discountSales;
    private Account $discountPurchase;
    private StockEntry $source;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, StockEntry::class]);

        $this->receivable       = $this->makeAccount('1210', 'Piutang', 'asset');
        $this->revenue          = $this->makeAccount('4110', 'Penjualan', 'income', 'credit');
        $this->payable          = $this->makeAccount('2211', 'Hutang', 'liability', 'credit');
        $this->expense          = $this->makeAccount('5110', 'Beban Jasa', 'expense', 'debit');
        $this->discountSales    = $this->makeAccount('4190', 'Potongan Penjualan', 'income', 'debit');
        $this->discountPurchase = $this->makeAccount('5190', 'Potongan Pembelian', 'expense', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->revenue->id,
            'payable'    => $this->payable->id,
            'expense'    => $this->expense->id,
            'discount'   => $this->discountSales->id,
        ], [
            ['role' => 'discount', 'account_id' => $this->discountPurchase->id, 'document_type' => 'purchase_invoice'],
        ]));

        $this->source = $this->makeStockEntry();
    }

    protected function tearDown(): void {
        mt_srand();

        parent::tearDown();
    }

    private function useMinorUnit(int $minorUnit): void {
        Currency::create(['code' => 'XTS', 'name' => 'Test', 'minor_unit' => $minorUnit]);
        CoreSetting::current()->forceFill(['default_currency_id' => 'XTS'])->save();
    }

    /**
     * @param  array<string, float|int>  $amounts
     * @param  array<string, mixed>  $flags
     * @param  list<LineAttributes>  $lines
     */
    protected function ctx(PostingDocumentType $type, array $amounts, array $flags, array $lines): PostingContext {
        return new PostingContext($type, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-22 10:00:00'), null, $amounts, $flags, [], $lines);
    }

    /**
     * @param  list<JournalDraft>  $drafts
     * @return array{debit: int, credit: int}
     */
    private function minorTotals(array $drafts, int $minorUnit): array {
        $debit = $credit = 0;
        foreach ($drafts as $draft) {
            foreach ($draft->lines as $line) {
                $debit += MinorUnit::toMinor($line->debit, $minorUnit);
                $credit += MinorUnit::toMinor($line->credit, $minorUnit);
            }
        }

        return ['debit' => $debit, 'credit' => $credit];
    }

    /**
     * Jumlah (minor unit) seluruh baris draft pada satu akun, sisi tertentu.
     *
     * @param  list<JournalDraft>  $drafts
     */
    private function accountMinor(array $drafts, Account $account, string $side, int $minorUnit): int {
        $sum = 0;
        foreach ($drafts as $draft) {
            foreach ($draft->lines as $line) {
                if ($line->accountId === $account->id) {
                    $sum += MinorUnit::toMinor($side === 'debit' ? $line->debit : $line->credit, $minorUnit);
                }
            }
        }

        return $sum;
    }

    public function test_sales_invoice_split_stays_balanced_and_keeps_receivable_equal_to_total_for_random_documents(): void {
        foreach ([2, 0] as $minorUnit) {
            if ($minorUnit === 0) {
                $this->useMinorUnit(0);
            }

            for ($seed = 1; $seed <= 120; $seed++) {
                [$lines, $totals] = $this->discountedDocument($seed);
                $amounts          = ['total' => $totals['total'], 'gross_amount' => $totals['gross_amount'], 'discount_amount' => $totals['discount_amount']];

                foreach ([false, true] as $return) {
                    $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, $amounts, ['discount_split' => true, 'is_return' => $return], $lines));
                    $sums   = $this->minorTotals($drafts, $minorUnit);

                    $this->assertSame($sums['debit'], $sums['credit'], "seed {$seed}, minor {$minorUnit}: jurnal seimbang setelah pembulatan");
                    $this->assertSame(
                        MinorUnit::toMinor($totals['total'], $minorUnit),
                        $this->accountMinor($drafts, $this->receivable, $return ? 'credit' : 'debit', $minorUnit),
                        "seed {$seed}, minor {$minorUnit}: receivable = total bersih",
                    );
                }
            }
        }
    }

    public function test_purchase_invoice_split_stays_balanced_and_keeps_payable_equal_to_total_for_random_documents(): void {
        foreach ([2, 0] as $minorUnit) {
            if ($minorUnit === 0) {
                $this->useMinorUnit(0);
            }

            for ($seed = 1; $seed <= 120; $seed++) {
                [$lines, $totals] = $this->discountedDocument($seed);
                $amounts          = ['total' => $totals['total'], 'stock_total' => 0, 'gross_amount' => $totals['non_stock_gross'], 'discount_amount' => $totals['non_stock_discount']];

                foreach ([false, true] as $return) {
                    $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::PurchaseInvoice, $amounts, ['discount_split' => true, 'is_return' => $return], $lines));
                    $sums   = $this->minorTotals($drafts, $minorUnit);

                    $this->assertSame($sums['debit'], $sums['credit'], "seed {$seed}, minor {$minorUnit}: jurnal seimbang setelah pembulatan");
                    $this->assertSame(
                        MinorUnit::toMinor($totals['total'], $minorUnit),
                        $this->accountMinor($drafts, $this->payable, $return ? 'debit' : 'credit', $minorUnit),
                        "seed {$seed}, minor {$minorUnit}: payable = total bersih",
                    );
                }
            }
        }
    }

    public function test_rounding_residue_is_absorbed_by_the_discount_line_not_the_receivable(): void {
        $this->useMinorUnit(0);

        // total 100,4 -> 100; diskon 1,4 -> 1; kotor 101,8 -> 102. Debit 101 vs kredit 102: tanpa pengecualian piutang
        // (kelompok debit terbesar) menyerap sisa menjadi 101. Dengan pengecualian, diskon menyerapnya (2).
        $line   = new LineAttributes(['amount' => 100.4, 'gross_amount' => 101.8, 'discount_amount' => 1.4], isStockItem: true);
        $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 100.4, 'gross_amount' => 101.8, 'discount_amount' => 1.4], ['discount_split' => true], [$line]));

        $this->assertSame(100, $this->accountMinor($drafts, $this->receivable, 'debit', 0));
        $this->assertSame(2, $this->accountMinor($drafts, $this->discountSales, 'debit', 0));
        $this->assertSame(102, $this->accountMinor($drafts, $this->revenue, 'credit', 0));
    }

    public function test_purchase_rounding_residue_is_absorbed_by_the_discount_line_not_the_payable(): void {
        $this->useMinorUnit(0);

        $line   = new LineAttributes(['amount' => 100.4, 'gross_amount' => 101.8, 'discount_amount' => 1.4], isStockItem: false);
        $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 100.4, 'stock_total' => 0, 'gross_amount' => 101.8, 'discount_amount' => 1.4], ['discount_split' => true], [$line]));

        $this->assertSame(100, $this->accountMinor($drafts, $this->payable, 'credit', 0));
        $this->assertSame(2, $this->accountMinor($drafts, $this->discountPurchase, 'credit', 0));
        $this->assertSame(102, $this->accountMinor($drafts, $this->expense, 'debit', 0));
    }

    public function test_sales_discount_below_one_minor_unit_drops_the_discount_line_and_keeps_the_journal_balanced(): void {
        $this->useMinorUnit(0);

        // total 100,3 -> 100; diskon 0,4 -> 0 (baris dibuang); kotor 100,7 -> 101. Tanpa penanganan: debit 100 vs kredit 101.
        $line   = new LineAttributes(['amount' => 100.3, 'gross_amount' => 100.7, 'discount_amount' => 0.4], isStockItem: true);
        $amount = ['total' => 100.3, 'gross_amount' => 100.7, 'discount_amount' => 0.4];

        $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, $amount, ['discount_split' => true], [$line]));
        $sums   = $this->minorTotals($drafts, 0);

        $this->assertSame($sums['debit'], $sums['credit']);
        $this->assertSame(100, $this->accountMinor($drafts, $this->receivable, 'debit', 0), 'piutang tetap sama dengan total');
        $this->assertSame(0, $this->accountMinor($drafts, $this->discountSales, 'debit', 0));
        $this->assertSame(100, $this->accountMinor($drafts, $this->revenue, 'credit', 0), 'pendapatan menyerap sisa, sama dengan jurnal bersih');

        // Retur menukar sisi; posting sungguhan tidak ditolak sebagai tak seimbang.
        $return = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, $amount, ['discount_split' => true, 'is_return' => true], [$line]));
        $this->assertSame(100, $this->accountMinor($return, $this->receivable, 'credit', 0));
        $this->assertSame(100, $this->accountMinor($return, $this->revenue, 'debit', 0));

        app(PostingService::class)->post($this->ctx(PostingDocumentType::SalesInvoice, $amount, ['discount_split' => true], [$line]), checkCanceled: false);
        $this->assertSame(1, Journal::query()->count());
    }

    public function test_sales_discount_of_one_minor_unit_that_must_absorb_a_reduction_falls_back_to_the_revenue_line(): void {
        $this->useMinorUnit(0);

        // total 100,5 -> 101; diskon 0,5 -> 1; kotor 101,0 -> 101. Debit 102 vs kredit 101: diskon (1) tidak dapat dikurangi
        // menjadi 0, piutang dilindungi, jadi pendapatan menyerap (102).
        $line   = new LineAttributes(['amount' => 100.5, 'gross_amount' => 101.0, 'discount_amount' => 0.5], isStockItem: true);
        $amount = ['total' => 100.5, 'gross_amount' => 101.0, 'discount_amount' => 0.5];

        $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, $amount, ['discount_split' => true], [$line]));
        $sums   = $this->minorTotals($drafts, 0);

        $this->assertSame($sums['debit'], $sums['credit']);
        $this->assertSame(101, $this->accountMinor($drafts, $this->receivable, 'debit', 0));
        $this->assertSame(1, $this->accountMinor($drafts, $this->discountSales, 'debit', 0));
        $this->assertSame(102, $this->accountMinor($drafts, $this->revenue, 'credit', 0));

        app(PostingService::class)->post($this->ctx(PostingDocumentType::SalesInvoice, $amount, ['discount_split' => true], [$line]), checkCanceled: false);
        $this->assertSame(1, Journal::query()->count());
    }

    public function test_purchase_discount_below_one_minor_unit_drops_the_discount_line_and_keeps_the_journal_balanced(): void {
        $this->useMinorUnit(0);

        // Baris non-stok: total 100,3 -> 100; diskon 0,4 -> 0; kotor 100,7 -> 101 (beban). Utang tetap 100, beban menyerap.
        $line   = new LineAttributes(['amount' => 100.3, 'gross_amount' => 100.7, 'discount_amount' => 0.4], isStockItem: false);
        $amount = ['total' => 100.3, 'stock_total' => 0, 'gross_amount' => 100.7, 'discount_amount' => 0.4];

        foreach ([false, true] as $isReturn) {
            $drafts = app(PostingService::class)->preview($this->ctx(PostingDocumentType::PurchaseInvoice, $amount, ['discount_split' => true, 'is_return' => $isReturn], [$line]));
            $sums   = $this->minorTotals($drafts, 0);

            $this->assertSame($sums['debit'], $sums['credit']);
            $this->assertSame(100, $this->accountMinor($drafts, $this->payable, $isReturn ? 'debit' : 'credit', 0));
            $this->assertSame(0, $this->accountMinor($drafts, $this->discountPurchase, $isReturn ? 'debit' : 'credit', 0));
            $this->assertSame(100, $this->accountMinor($drafts, $this->expense, $isReturn ? 'credit' : 'debit', 0));
        }

        app(PostingService::class)->post($this->ctx(PostingDocumentType::PurchaseInvoice, $amount, ['discount_split' => true], [$line]), checkCanceled: false);
        $this->assertSame(1, Journal::query()->count());
    }

    public function test_tiny_discounts_stay_balanced_and_keep_the_net_amount_at_minor_unit_zero(): void {
        $this->useMinorUnit(0);

        $checked = 0;
        // Pecahan sen di sekitar batas pembulatan; tiap pratinjau menyentuh DB sehingga sampelnya sengaja kecil.
        foreach ([0, 20, 49, 50, 51, 70, 99] as $cents) {
            $total = round(100 + $cents / 100, 2);

            foreach ([0.1, 0.4, 0.5, 0.9, 1.0, 1.5] as $discount) {
                $gross = round($total + $discount, 2);
                $line  = new LineAttributes(['amount' => $total, 'gross_amount' => $gross, 'discount_amount' => $discount], isStockItem: false);

                foreach ([false, true] as $return) {
                    $sales = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, ['total' => $total, 'gross_amount' => $gross, 'discount_amount' => $discount], ['discount_split' => true, 'is_return' => $return], [$line]));
                    $sums  = $this->minorTotals($sales, 0);
                    $this->assertSame($sums['debit'], $sums['credit'], "sales total {$total} diskon {$discount}");
                    $this->assertSame(MinorUnit::toMinor($total, 0), $this->accountMinor($sales, $this->receivable, $return ? 'credit' : 'debit', 0), "sales total {$total} diskon {$discount}: piutang = total");

                    $purchase = app(PostingService::class)->preview($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => $total, 'stock_total' => 0, 'gross_amount' => $gross, 'discount_amount' => $discount], ['discount_split' => true, 'is_return' => $return], [$line]));
                    $sums     = $this->minorTotals($purchase, 0);
                    $this->assertSame($sums['debit'], $sums['credit'], "purchase total {$total} diskon {$discount}");
                    $this->assertSame(MinorUnit::toMinor($total, 0), $this->accountMinor($purchase, $this->payable, $return ? 'debit' : 'credit', 0), "purchase total {$total} diskon {$discount}: utang = total");

                    $checked += 2;
                }
            }
        }

        $this->assertSame(168, $checked);
    }

    public function test_discount_accounts_differ_between_sales_and_purchase_invoice_by_document_type_rule(): void {
        $line = new LineAttributes(['amount' => 900, 'gross_amount' => 1000, 'discount_amount' => 100], isStockItem: false);

        $sales    = app(PostingService::class)->preview($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 900, 'gross_amount' => 1000, 'discount_amount' => 100], ['discount_split' => true], [$line]));
        $purchase = app(PostingService::class)->preview($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 900, 'stock_total' => 0, 'gross_amount' => 1000, 'discount_amount' => 100], ['discount_split' => true], [$line]));

        $this->assertSame(100, $this->accountMinor($sales, $this->discountSales, 'debit', 2) / 100);
        $this->assertSame(0, $this->accountMinor($sales, $this->discountPurchase, 'debit', 2));
        $this->assertSame(100, $this->accountMinor($purchase, $this->discountPurchase, 'credit', 2) / 100);
        $this->assertSame(0, $this->accountMinor($purchase, $this->discountSales, 'credit', 2));
    }

    public function test_post_writes_a_balanced_split_journal_to_the_ledger(): void {
        $line = new LineAttributes(['amount' => 1498500, 'gross_amount' => 1648500, 'discount_amount' => 150000], isStockItem: true);
        $ctx  = $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 1498500, 'gross_amount' => 1648500, 'discount_amount' => 150000], ['discount_split' => true], [$line]);

        app(PostingService::class)->post($ctx, checkCanceled: false);

        $journal = Journal::query()->firstOrFail();
        $rows    = GeneralLedger::query()->where('journal_id', $journal->id)->get();

        $this->assertEqualsWithDelta(1498500, (float) $rows->firstWhere('account_id', $this->receivable->id)->debit, 1e-6);
        $this->assertEqualsWithDelta(150000, (float) $rows->firstWhere('account_id', $this->discountSales->id)->debit, 1e-6);
        $this->assertEqualsWithDelta(1648500, (float) $rows->firstWhere('account_id', $this->revenue->id)->credit, 1e-6);
        $this->assertEqualsWithDelta((float) $rows->sum('debit'), (float) $rows->sum('credit'), 1e-6);
    }
}
