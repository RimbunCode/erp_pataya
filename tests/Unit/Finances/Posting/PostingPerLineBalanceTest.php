<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingRuleRegistry;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.6 (P-12, Requirement 12.4): penggabungan jurnal per baris (peka-barang) tetap seimbang dan
 * tidak mengubah total jurnal dibanding bentuk dokumen (tanpa `lines`). Properti diuji pada ratusan dokumen acak
 * (seed tetap, tanpa DB) untuk setiap rule yang memecah baris: Sales Invoice, Purchase Invoice, Purchase Receipt,
 * Delivery Note, dan Stock Entry, termasuk retur, baris bernilai nol, dan jumlah baris yang tidak sama dengan total
 * (rule jatuh ke bentuk dokumen). Posting diskon terpisah dicakup `DiscountSplitBalanceTest` (P-13); keseimbangan
 * setelah pembulatan ke minor unit dicakup `PostingServiceTest`.
 */
class PostingPerLineBalanceTest extends TestCase {
    private const TOLERANCE = 1e-6;
    private const SEEDS     = 300;

    protected function tearDown(): void {
        mt_srand(); // kembalikan seed acak agar tes lain (faker) tidak ikut deterministik

        parent::tearDown();
    }

    /**
     * Baris acak dalam sen: 1-6 baris, sebagian bernilai nol; atribut stok acak.
     *
     * @return array{0: list<LineAttributes>, 1: float}
     */
    private function randomLines(int $seed): array {
        mt_srand($seed);

        $lines = [];
        $total = 0;
        for ($i = 0, $count = mt_rand(1, 6); $i < $count; $i++) {
            $cents = mt_rand(0, 4) === 0 ? 0 : mt_rand(1, 50_000_000);
            $total += $cents;
            $lines[] = new LineAttributes(['amount' => $cents / 100], isStockItem: (bool) mt_rand(0, 1), lineId: "L{$i}");
        }

        return [$lines, $total / 100];
    }

    /**
     * @param  array<string, float|int>  $amounts
     * @param  array<string, mixed>  $flags
     * @param  list<LineAttributes>  $lines
     * @return list<RoleJournalDraft>
     */
    private function build(PostingDocumentType $type, array $amounts, array $flags, array $lines, int $seed): array {
        $ctx = new PostingContext($type, 'App\\Models\\Doc', "doc-{$seed}", CarbonImmutable::parse('2026-11-27'), null, $amounts, $flags, [], $lines);

        return (new PostingRuleRegistry)->for($type)->build($ctx);
    }

    /**
     * Total per purpose, sisi, dan peran (peran per baris dijumlahkan: inilah yang digabung engine per akun).
     *
     * @param  list<RoleJournalDraft>  $drafts
     * @return array<string, float>
     */
    private function totals(array $drafts): array {
        $totals = [];
        foreach ($drafts as $draft) {
            foreach ($draft->lines as $line) {
                $key          = "{$draft->purpose}|{$line->side}|{$line->roleValue()}";
                $totals[$key] = ($totals[$key] ?? 0.0) + (float) $line->amount;
            }
        }
        ksort($totals);

        return $totals;
    }

    /**
     * @param  list<RoleJournalDraft>  $drafts
     */
    private function assertEveryJournalBalanced(array $drafts, string $message): void {
        foreach ($drafts as $draft) {
            $debit = $credit = 0.0;
            foreach ($draft->lines as $line) {
                if ($line->side === RoleLine::DEBIT) {
                    $debit += (float) $line->amount;
                } else {
                    $credit += (float) $line->amount;
                }
            }
            $this->assertEqualsWithDelta($debit, $credit, self::TOLERANCE, "{$message}: jurnal {$draft->purpose} seimbang");
        }
    }

    /**
     * Bentuk per baris dan bentuk dokumen harus identik dalam total per sisi dan peran, dan keduanya seimbang.
     *
     * @param  list<RoleJournalDraft>  $perLine
     * @param  list<RoleJournalDraft>  $document
     */
    private function assertSameTotalsAsDocumentShape(array $perLine, array $document, string $message): void {
        $this->assertEveryJournalBalanced($perLine, $message);
        $this->assertEveryJournalBalanced($document, "{$message} (bentuk dokumen)");

        $expected = $this->totals($document);
        $actual   = $this->totals($perLine);
        $this->assertSame(array_keys($expected), array_keys($actual), "{$message}: purpose/sisi/peran sama dengan bentuk dokumen");
        foreach ($expected as $key => $amount) {
            $this->assertEqualsWithDelta($amount, $actual[$key], self::TOLERANCE, "{$message}: total {$key}");
        }
    }

    public function test_sales_invoice_per_line_revenue_keeps_the_document_totals_and_balance(): void {
        $multi = 0;

        for ($seed = 1; $seed <= self::SEEDS; $seed++) {
            [$lines, $total] = $this->randomLines($seed);

            foreach ([false, true] as $return) {
                $flags    = ['is_return' => $return];
                $perLine  = $this->build(PostingDocumentType::SalesInvoice, ['total' => $total], $flags, $lines, $seed);
                $document = $this->build(PostingDocumentType::SalesInvoice, ['total' => $total], $flags, [], $seed);

                $this->assertSameTotalsAsDocumentShape($perLine, $document, "seed {$seed} retur=" . (int) $return);
            }

            if (\count(array_filter($lines, fn (LineAttributes $l): bool => $l->amount('amount') > 0)) > 1) {
                $multi++;
            }
        }

        $this->assertGreaterThan(100, $multi, 'sampel acak harus memuat cukup dokumen berbaris banyak');
    }

    public function test_purchase_invoice_per_line_expense_keeps_the_document_totals_and_balance(): void {
        for ($seed = 1; $seed <= self::SEEDS; $seed++) {
            [$lines, $total] = $this->randomLines($seed);
            mt_srand($seed + 10_000);
            $stockTotal = mt_rand(0, 1) ? round($total * mt_rand(0, 100) / 100, 2) : 0;

            foreach ([false, true] as $return) {
                $amounts  = ['total' => $total, 'stock_total' => $stockTotal];
                $flags    = ['is_return' => $return];
                $perLine  = $this->build(PostingDocumentType::PurchaseInvoice, $amounts, $flags, $lines, $seed);
                $document = $this->build(PostingDocumentType::PurchaseInvoice, $amounts, $flags, [], $seed);

                $this->assertSameTotalsAsDocumentShape($perLine, $document, "seed {$seed} retur=" . (int) $return);
            }
        }
    }

    public function test_purchase_receipt_per_line_stock_keeps_the_document_totals_even_when_lines_do_not_match_total(): void {
        $fallbacks = 0;

        for ($seed = 1; $seed <= self::SEEDS; $seed++) {
            [$lines, $total] = $this->randomLines($seed);

            // Setiap 4 seed jumlah baris sengaja tidak sama dengan total (nilai hitung ulang jalur retry): rule jatuh ke bentuk dokumen.
            $documentTotal = $seed % 4 === 0 ? $total + 1.5 : $total;
            if ($seed % 4 === 0 && $total > 0) {
                $fallbacks++;
            }

            foreach ([false, true] as $return) {
                $flags    = ['is_return' => $return];
                $perLine  = $this->build(PostingDocumentType::PurchaseReceipt, ['total' => $documentTotal], $flags, $lines, $seed);
                $document = $this->build(PostingDocumentType::PurchaseReceipt, ['total' => $documentTotal], $flags, [], $seed);

                $this->assertSameTotalsAsDocumentShape($perLine, $document, "seed {$seed} retur=" . (int) $return);
            }
        }

        $this->assertGreaterThan(20, $fallbacks, 'sampel acak harus memuat jalur jatuh ke bentuk dokumen');
    }

    public function test_delivery_note_per_line_pairs_keep_the_document_totals_and_balance(): void {
        $fallbacks = 0;

        for ($seed = 1; $seed <= self::SEEDS; $seed++) {
            [$lines, $total] = $this->randomLines($seed);

            $documentTotal = $seed % 4 === 0 ? $total + 2.25 : $total;
            if ($seed % 4 === 0 && $total > 0) {
                $fallbacks++;
            }

            foreach ([false, true] as $return) {
                $flags    = ['is_return' => $return];
                $perLine  = $this->build(PostingDocumentType::DeliveryNote, ['total_picked' => $documentTotal], $flags, $lines, $seed);
                $document = $this->build(PostingDocumentType::DeliveryNote, ['total_picked' => $documentTotal], $flags, [], $seed);

                $this->assertSameTotalsAsDocumentShape($perLine, $document, "seed {$seed} retur=" . (int) $return);
            }
        }

        $this->assertGreaterThan(20, $fallbacks, 'sampel acak harus memuat jalur jatuh ke bentuk dokumen');
    }

    public function test_stock_entry_per_line_adjustment_keeps_the_document_totals_and_balance(): void {
        for ($seed = 1; $seed <= self::SEEDS; $seed++) {
            [$lines, $total] = $this->randomLines($seed);

            foreach (['item_receipt', 'item_issue'] as $type) {
                $flags    = ['entry_type' => $type, 'additional_costs' => [['id' => "C{$seed}", 'amount' => 12.34]]];
                $amounts  = ['basic_total' => $total];
                $perLine  = $this->build(PostingDocumentType::StockEntry, $amounts, $flags, $lines, $seed);
                $document = $this->build(PostingDocumentType::StockEntry, $amounts, $flags, [], $seed);

                $this->assertSameTotalsAsDocumentShape($perLine, $document, "seed {$seed} {$type}");
            }
        }
    }
}
