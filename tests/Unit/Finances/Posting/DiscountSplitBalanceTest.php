<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingRuleRegistry;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use Carbon\CarbonImmutable;
use Tests\Support\GeneratesDiscountedInvoiceAmounts;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 13.3 (P-13, Requirement 14.2-14.3): dengan `discount_split` aktif, Σdebit = Σkredit dan jumlah
 * `receivable`/`payable` sama dengan total bersih dokumen. Properti diuji pada ratusan dokumen acak (seed tetap, tanpa
 * DB) yang dialokasikan `DocumentDiscountCalculator` seperti invoice sungguhan: basis `net_total` dan `grand_total`,
 * tarif pajak 0/11/12, DPP berfaktor 11/12. Keseimbangan setelah pembulatan ke minor unit diuji di
 * `DiscountSplitPostingTest` (lewat `PostingService::post()`).
 */
class DiscountSplitBalanceTest extends TestCase {
    use GeneratesDiscountedInvoiceAmounts;

    private const TOLERANCE = 1e-6;

    protected function tearDown(): void {
        mt_srand(); // kembalikan seed acak agar tes lain (faker) tidak ikut deterministik

        parent::tearDown();
    }

    /**
     * @return array{debit: float, credit: float}
     */
    private function sides(RoleJournalDraft $draft): array {
        $sum = [RoleLine::DEBIT => 0.0, RoleLine::CREDIT => 0.0];
        foreach ($draft->lines as $line) {
            $sum[$line->side] += (float) $line->amount;
        }

        return ['debit' => $sum[RoleLine::DEBIT], 'credit' => $sum[RoleLine::CREDIT]];
    }

    private function roleTotal(RoleJournalDraft $draft, string $role): float {
        return array_sum(array_map(
            fn (RoleLine $line): float => $line->roleValue() === $role ? (float) $line->amount : 0.0,
            $draft->lines,
        ));
    }

    public function test_sales_invoice_split_is_balanced_and_receivable_equals_net_total_for_random_documents(): void {
        $registry = new PostingRuleRegistry;
        $splits   = 0;

        for ($seed = 1; $seed <= 300; $seed++) {
            [$lines, $totals] = $this->discountedDocument($seed);

            foreach ([false, true] as $return) {
                $ctx = new PostingContext(
                    PostingDocumentType::SalesInvoice,
                    'App\\Models\\Doc',
                    "doc-{$seed}",
                    CarbonImmutable::parse('2026-11-22'),
                    null,
                    ['total'          => $totals['total'], 'gross_amount' => $totals['gross_amount'], 'discount_amount' => $totals['discount_amount']],
                    ['discount_split' => true, 'is_return' => $return],
                    [],
                    $lines,
                );

                $drafts = $registry->for(PostingDocumentType::SalesInvoice)->build($ctx);
                $this->assertCount(1, $drafts, "seed {$seed}");
                $sides = $this->sides($drafts[0]);

                $this->assertEqualsWithDelta($sides['debit'], $sides['credit'], self::TOLERANCE, "seed {$seed}: jurnal seimbang");
                $this->assertEqualsWithDelta($totals['total'], $this->roleTotal($drafts[0], 'receivable'), self::TOLERANCE, "seed {$seed}: receivable = total bersih");
                $this->assertEqualsWithDelta($totals['discount_amount'], $this->roleTotal($drafts[0], 'discount'), self::TOLERANCE, "seed {$seed}: discount = Σ diskon");
                $this->assertEqualsWithDelta($totals['gross_amount'], $this->roleTotal($drafts[0], 'revenue'), self::TOLERANCE, "seed {$seed}: revenue = Σ kotor");
                $this->assertEqualsWithDelta($totals['total'] + $totals['discount_amount'], $this->roleTotal($drafts[0], 'revenue'), self::TOLERANCE, "seed {$seed}: revenue = total bersih + diskon (tidak bergantung gross_amount baris)");

                if ($totals['discount_amount'] > 0) {
                    $splits++;
                }
            }
        }

        $this->assertGreaterThan(100, $splits, 'sampel acak harus memuat cukup dokumen berdiskon');
    }

    public function test_purchase_invoice_split_is_balanced_and_payable_equals_net_total_for_random_documents(): void {
        $registry = new PostingRuleRegistry;
        $splits   = 0;

        for ($seed = 1; $seed <= 300; $seed++) {
            [$lines, $totals] = $this->discountedDocument($seed);

            foreach ([false, true] as $return) {
                $ctx = new PostingContext(
                    PostingDocumentType::PurchaseInvoice,
                    'App\\Models\\Doc',
                    "doc-{$seed}",
                    CarbonImmutable::parse('2026-11-22'),
                    null,
                    ['total'          => $totals['total'], 'stock_total' => 0, 'gross_amount' => $totals['non_stock_gross'], 'discount_amount' => $totals['non_stock_discount']],
                    ['discount_split' => true, 'is_return' => $return],
                    [],
                    $lines,
                );

                $drafts = $registry->for(PostingDocumentType::PurchaseInvoice)->build($ctx);
                $this->assertCount(1, $drafts, "seed {$seed}");
                $this->assertSame('expense', $drafts[0]->purpose);
                $sides = $this->sides($drafts[0]);

                $this->assertEqualsWithDelta($sides['debit'], $sides['credit'], self::TOLERANCE, "seed {$seed}: jurnal seimbang");
                $this->assertEqualsWithDelta($totals['total'], $this->roleTotal($drafts[0], 'payable'), self::TOLERANCE, "seed {$seed}: payable = total bersih");
                $this->assertEqualsWithDelta($totals['non_stock_discount'], $this->roleTotal($drafts[0], 'discount'), self::TOLERANCE, "seed {$seed}: discount = Σ diskon non-stok");

                if ($totals['non_stock_discount'] > 0) {
                    $splits++;
                }
            }
        }

        $this->assertGreaterThan(50, $splits, 'sampel acak harus memuat cukup dokumen berdiskon non-stok');
    }

    public function test_purchase_invoice_split_keeps_lines_without_stock_attribute_net(): void {
        $registry = new PostingRuleRegistry;
        $unknown  = 0;

        for ($seed = 1; $seed <= 300; $seed++) {
            [$lines, $totals] = $this->discountedDocument($seed, withUnknownStock: true);

            foreach ([false, true] as $return) {
                $ctx = new PostingContext(
                    PostingDocumentType::PurchaseInvoice,
                    'App\\Models\\Doc',
                    "doc-{$seed}",
                    CarbonImmutable::parse('2026-11-22'),
                    null,
                    ['total'          => $totals['total'], 'stock_total' => 0, 'gross_amount' => $totals['non_stock_gross'], 'discount_amount' => $totals['non_stock_discount']],
                    ['discount_split' => true, 'is_return' => $return],
                    [],
                    $lines,
                );

                $drafts = $registry->for(PostingDocumentType::PurchaseInvoice)->build($ctx);
                $this->assertCount(1, $drafts, "seed {$seed}");
                $sides = $this->sides($drafts[0]);

                // Beban = bersih semua baris + diskon baris tegas non-stok (baris stok dan baris tanpa atribut tetap bersih).
                $expectedExpense = $totals['total'] + $totals['non_stock_discount'];

                $this->assertEqualsWithDelta($sides['debit'], $sides['credit'], self::TOLERANCE, "seed {$seed}: jurnal seimbang");
                $this->assertEqualsWithDelta($expectedExpense, $this->roleTotal($drafts[0], 'expense'), self::TOLERANCE, "seed {$seed}: beban memakai kotor hanya untuk baris tegas non-stok");
                $this->assertEqualsWithDelta($totals['non_stock_discount'], $this->roleTotal($drafts[0], 'discount'), self::TOLERANCE, "seed {$seed}: discount = Σ diskon baris non-stok");

                foreach ($lines as $line) {
                    if ($line->isStockItem === null && $line->amount('discount_amount') > 0) {
                        $unknown++;
                    }
                }
            }
        }

        $this->assertGreaterThan(50, $unknown, 'sampel acak harus memuat baris berdiskon tanpa atribut stok');
    }

    public function test_split_never_changes_the_net_receivable_compared_with_the_unsplit_shape(): void {
        $registry = new PostingRuleRegistry;

        for ($seed = 1; $seed <= 100; $seed++) {
            [$lines, $totals] = $this->discountedDocument($seed);
            $amounts          = ['total' => $totals['total'], 'gross_amount' => $totals['gross_amount'], 'discount_amount' => $totals['discount_amount']];
            $make             = fn (bool $split): PostingContext => new PostingContext(PostingDocumentType::SalesInvoice, 'App\\Models\\Doc', "doc-{$seed}", CarbonImmutable::parse('2026-11-22'), null, $amounts, ['discount_split' => $split], [], $lines);

            $net   = $registry->for(PostingDocumentType::SalesInvoice)->build($make(false))[0];
            $split = $registry->for(PostingDocumentType::SalesInvoice)->build($make(true))[0];

            $this->assertEqualsWithDelta($this->roleTotal($net, 'receivable'), $this->roleTotal($split, 'receivable'), self::TOLERANCE, "seed {$seed}");
            $this->assertEqualsWithDelta($this->roleTotal($net, 'revenue') + $totals['discount_amount'], $this->roleTotal($split, 'revenue'), self::TOLERANCE, "seed {$seed}: kotor = bersih + diskon");
        }
    }
}
