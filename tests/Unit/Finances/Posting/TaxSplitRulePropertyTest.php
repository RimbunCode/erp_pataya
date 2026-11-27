<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use App\Services\Finances\Posting\Rules\PurchaseInvoiceRule;
use App\Services\Finances\Posting\Rules\SalesInvoiceRule;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 3, Task 6.5 (P-1, P-8 pada tingkat rule murni): untuk komponen dan baris acak, jurnal hasil rule seimbang,
 * Σ baris pajak = Σ komponen yang dipisah, baris `revenue`/`expense` adalah sisa, retur menukar sisi tanpa mengubah
 * jumlah, dan tanpa flag/komponen bentuk jurnal identik dengan bentuk lama.
 */
class TaxSplitRulePropertyTest extends TestCase {
    private const RUNS = 60;

    /**
     * @return array{0: list<LineAttributes>, 1: list<TaxComponentLine>, 2: float, 3: float} baris, komponen, total bersih, diskon (Sales: semua baris; Purchase: baris non-stok)
     */
    private function randomDocument(int $seed, bool $purchase, bool $withDiscount = false): array {
        mt_srand($seed);
        $lineCount = mt_rand(1, 5);
        $versions  = ['v-a', 'v-b', 'v-c'];

        $lines    = [];
        $shares   = ['v-a' => [], 'v-b' => [], 'v-c' => []];
        $total    = 0.0;
        $discount = 0.0;
        for ($i = 0; $i < $lineCount; $i++) {
            $basic = mt_rand(1_000, 90_000_000) / 100;
            $ver   = $versions[mt_rand(0, 2)];
            $tax   = round($basic * 11 / 12 * mt_rand(0, 12) / 100, 6);
            $off   = $withDiscount ? round($basic * mt_rand(0, 20) / 100, 2) : 0.0;
            $stock = $purchase && $withDiscount && mt_rand(0, 2) === 0;

            $lines[]               = new LineAttributes(['amount' => $basic - $off + $tax, 'gross_amount' => $basic + $tax, 'discount_amount' => $off], isStockItem: $stock, lineId: "l{$i}");
            $shares[$ver]["l{$i}"] = $tax;
            $total += $basic - $off + $tax;
            // Purchase Invoice: hanya diskon baris non-stok yang dipisah (baris stok masuk nilai persediaan).
            $discount += $stock ? 0.0 : $off;
        }

        $components = [];
        foreach ($shares as $ver => $map) {
            if ($map === []) {
                continue;
            }
            $components[] = new TaxComponentLine($ver, $purchase ? 'tax_input' : 'tax_output', array_sum($map), true, true, $map, 'tax-' . $ver);
        }

        return [$lines, $components, $total, $discount];
    }

    private function context(PostingDocumentType $type, array $lines, array $components, float $total, bool $return, bool $split, float $discount = 0.0, bool $discountSplit = false): PostingContext {
        return new PostingContext(
            documentType: $type,
            sourceType: 'x',
            sourceId: '1',
            transactionDate: CarbonImmutable::parse('2026-11-27'),
            branchId: null,
            amounts: ['total' => $total, 'discount_amount' => $discount],
            flags: ['is_return' => $return, 'tax_split' => $split, 'discount_split' => $discountSplit],
            lines: $lines,
            taxComponents: $components,
        );
    }

    /**
     * @param  list<RoleJournalDraft>  $drafts
     * @return array{debit: float, credit: float, tax: float, remainder: float}
     */
    private function summarize(array $drafts, string $purpose, string $taxRole, string $baseRole): array {
        $draft = collect($drafts)->firstWhere('purpose', $purpose);
        $this->assertNotNull($draft);

        $debit = $credit = $tax = $remainder = 0.0;
        foreach ($draft->lines as $line) {
            $amount = (float) $line->amount;
            $line->side === RoleLine::DEBIT ? $debit += $amount : $credit += $amount;
            if ($line->roleValue() === $taxRole) {
                $tax += $amount;
                $this->assertNotNull($line->taxRuleVersionId, 'Setiap baris pajak membawa versi aturan.');
            }
            if ($line->roleValue() === $baseRole) {
                $remainder += $amount;
            }
        }

        return ['debit' => $debit, 'credit' => $credit, 'tax' => $tax, 'remainder' => $remainder];
    }

    public function test_sales_invoice_journal_is_balanced_for_random_documents_and_returns(): void {
        for ($seed = 1; $seed <= self::RUNS; $seed++) {
            [$lines, $components, $total] = $this->randomDocument($seed, false);
            $taxSum                       = array_sum(array_map(fn (TaxComponentLine $c): float => $c->amount, $components));

            foreach ([false, true] as $return) {
                $drafts = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, $lines, $components, $total, $return, true));
                $sum    = $this->summarize($drafts, 'default', 'tax_output', 'revenue');

                $this->assertEqualsWithDelta($sum['debit'], $sum['credit'], 1e-6, "seed {$seed}: seimbang");
                $this->assertEqualsWithDelta($taxSum, $sum['tax'], 1e-6, "seed {$seed}: Σ pajak = Σ komponen (P-1)");
                $this->assertEqualsWithDelta($total - $taxSum, $sum['remainder'], 1e-6, "seed {$seed}: pendapatan = sisa");
            }
        }
    }

    public function test_purchase_invoice_journal_is_balanced_for_random_documents_and_returns(): void {
        for ($seed = 100; $seed < 100 + self::RUNS; $seed++) {
            [$lines, $components, $total] = $this->randomDocument($seed, true);
            $taxSum                       = array_sum(array_map(fn (TaxComponentLine $c): float => $c->amount, $components));

            foreach ([false, true] as $return) {
                $drafts = (new PurchaseInvoiceRule)->build($this->context(PostingDocumentType::PurchaseInvoice, $lines, $components, $total, $return, true));
                $sum    = $this->summarize($drafts, 'expense', 'tax_input', 'expense');
                // `expense` pada ringkasan memuat sisa beban; baris pajak dihitung terpisah dari peran `tax_input`.
                $this->assertEqualsWithDelta($sum['debit'], $sum['credit'], 1e-6, "seed {$seed}: seimbang");
                $this->assertEqualsWithDelta($taxSum, $sum['tax'], 1e-6, "seed {$seed}: Σ pajak = Σ komponen (P-1)");
                $this->assertEqualsWithDelta($total - $taxSum, $sum['remainder'], 1e-6, "seed {$seed}: beban = sisa");
            }
        }
    }

    /**
     * Diskon bukan nol dan flag `discount_split` bersama pemisahan pajak: seimbang, Σ pajak = Σ komponen, dan
     * pendapatan/beban = total + diskon terpisah - pajak.
     */
    public function test_sales_invoice_with_discount_split_and_tax_split_is_balanced(): void {
        for ($seed = 200; $seed < 200 + self::RUNS; $seed++) {
            [$lines, $components, $total, $discount] = $this->randomDocument($seed, false, true);
            $taxSum                                  = array_sum(array_map(fn (TaxComponentLine $c): float => $c->amount, $components));

            foreach ([false, true] as $return) {
                $drafts = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, $lines, $components, $total, $return, true, $discount, true));
                $sum    = $this->summarize($drafts, 'default', 'tax_output', 'revenue');

                $this->assertEqualsWithDelta($sum['debit'], $sum['credit'], 1e-6, "seed {$seed}: seimbang");
                $this->assertEqualsWithDelta($taxSum, $sum['tax'], 1e-6, "seed {$seed}: Σ pajak = Σ komponen");
                $this->assertEqualsWithDelta($total + $discount - $taxSum, $sum['remainder'], 1e-6, "seed {$seed}: pendapatan kotor - pajak");
            }
        }
    }

    public function test_purchase_invoice_with_discount_split_and_tax_split_is_balanced(): void {
        for ($seed = 300; $seed < 300 + self::RUNS; $seed++) {
            [$lines, $components, $total, $discount] = $this->randomDocument($seed, true, true);
            $taxSum                                  = array_sum(array_map(fn (TaxComponentLine $c): float => $c->amount, $components));

            foreach ([false, true] as $return) {
                $drafts = (new PurchaseInvoiceRule)->build($this->context(PostingDocumentType::PurchaseInvoice, $lines, $components, $total, $return, true, $discount, true));
                $sum    = $this->summarize($drafts, 'expense', 'tax_input', 'expense');

                $this->assertEqualsWithDelta($sum['debit'], $sum['credit'], 1e-6, "seed {$seed}: seimbang");
                $this->assertEqualsWithDelta($taxSum, $sum['tax'], 1e-6, "seed {$seed}: Σ pajak = Σ komponen");
                $this->assertEqualsWithDelta($total + $discount - $taxSum, $sum['remainder'], 1e-6, "seed {$seed}: beban kotor non-stok - pajak");
            }
        }
    }

    public function test_without_the_flag_or_components_the_journal_is_the_legacy_form(): void {
        [$lines, $components, $total] = $this->randomDocument(7, false);

        $legacy = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, $lines, [], $total, false, false));
        $noFlag = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, $lines, $components, $total, false, false));
        $noComp = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, $lines, [], $total, false, true));

        $this->assertEquals($legacy, $noFlag, 'Tanpa flag cutover bentuk lama.');
        $this->assertEquals($legacy, $noComp, 'Tanpa komponen bentuk lama.');
        $this->assertSame(0, collect($legacy[0]->lines)->filter(fn (RoleLine $l): bool => $l->roleValue() === 'tax_output')->count());
    }

    public function test_unsplittable_components_are_ignored_by_the_rule(): void {
        [$lines, , $total] = $this->randomDocument(11, true);
        $embedded          = [
            new TaxComponentLine('v-a', 'tax_input', 100.0, false, true, ['l0' => 100.0]),   // tak dapat dikreditkan
            new TaxComponentLine('v-b', 'tax_input', 100.0, true, false, ['l0' => 100.0]),   // tak terklasifikasi
            new TaxComponentLine(null, 'tax_input', 100.0, true, true, ['l0' => 100.0]),     // legacy tanpa versi
        ];

        $legacy = (new PurchaseInvoiceRule)->build($this->context(PostingDocumentType::PurchaseInvoice, $lines, [], $total, false, true));
        $split  = (new PurchaseInvoiceRule)->build($this->context(PostingDocumentType::PurchaseInvoice, $lines, $embedded, $total, false, true));

        $this->assertEquals($legacy, $split);
    }

    public function test_sales_without_lines_uses_total_minus_tax_as_the_single_revenue_line(): void {
        $component = new TaxComponentLine('v-a', 'tax_output', 120.0, true, true, []);

        $drafts = (new SalesInvoiceRule)->build($this->context(PostingDocumentType::SalesInvoice, [], [$component], 1120.0, false, true));
        $sum    = $this->summarize($drafts, 'default', 'tax_output', 'revenue');

        $this->assertEqualsWithDelta(1000.0, $sum['remainder'], 1e-9);
        $this->assertEqualsWithDelta(120.0, $sum['tax'], 1e-9);
        $this->assertEqualsWithDelta($sum['debit'], $sum['credit'], 1e-9);
    }
}
