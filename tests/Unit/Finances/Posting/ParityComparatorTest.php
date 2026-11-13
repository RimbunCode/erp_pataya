<?php

namespace Tests\Unit\Finances\Posting;

use App\Models\Finances\PostingParityLog;
use App\Services\Finances\Posting\ParityComparator;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 2, Task 5.2: komparator parity murni (tanpa DB), Requirement 6.5-6.6. Kanonisasi per `purpose`,
 * status `match`/`rounding`/`config_diff`/`mismatch` dengan prioritas mismatch > config_diff > rounding > match.
 */
class ParityComparatorTest extends TestCase {
    private ParityComparator $comparator;

    protected function setUp(): void {
        parent::setUp();
        $this->comparator = new ParityComparator;
    }

    /**
     * @param  list<array{0: string, 1: int, 2: int}>  $lines  [account, debit, credit]
     * @return array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}
     */
    private function journal(array $lines, string $date = '2026-11-12'): array {
        return ['date' => $date, 'lines' => array_map(fn (array $l): array => ['account_id' => $l[0], 'debit' => $l[1], 'credit' => $l[2]], $lines)];
    }

    public function test_identical_journals_match(): void {
        $side = ['default' => $this->journal([['A', 150000, 0], ['B', 0, 150000]])];

        $result = $this->comparator->compare($side, $side);

        $this->assertSame(PostingParityLog::STATUS_MATCH, $result->status);
        $this->assertSame([], $result->diff);
    }

    public function test_one_minor_unit_difference_is_rounding(): void {
        $legacy = ['default' => $this->journal([['A', 10001, 0], ['B', 0, 10001]])];
        $engine = ['default' => $this->journal([['A', 10002, 0], ['B', 0, 10001]])];

        $this->assertSame(PostingParityLog::STATUS_ROUNDING, $this->comparator->compare($legacy, $engine)->status);
    }

    public function test_difference_beyond_one_minor_unit_is_mismatch(): void {
        $legacy = ['default' => $this->journal([['A', 10000, 0], ['B', 0, 10000]])];
        $engine = ['default' => $this->journal([['A', 10002, 0], ['B', 0, 10002]])];

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine)->status);
    }

    public function test_only_accounts_differing_is_config_diff_and_keeps_the_differing_accounts_of_both_sides(): void {
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['A', 500, 0], ['C', 0, 500]])];

        $result = $this->comparator->compare($legacy, $engine, 'sales_invoice');

        $this->assertSame(PostingParityLog::STATUS_CONFIG_DIFF, $result->status);
        $this->assertSame(['B'], $result->diff['default']['legacy_accounts']);
        $this->assertSame(['C'], $result->diff['default']['engine_accounts']);
    }

    public function test_different_journal_count_or_purposes_is_mismatch(): void {
        $stock   = $this->journal([['S', 600, 0], ['R', 0, 600]]);
        $expense = $this->journal([['E', 1000, 0], ['P', 0, 1000]]);

        $result = $this->comparator->compare(['stock' => $stock, 'expense' => $expense], ['expense' => $expense]);

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $result->status);
        $this->assertSame(['stock'], $result->diff['purposes']['missing_in_engine']);

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare(['expense' => $expense], ['expense' => $expense, 'stock' => $stock])->status);
    }

    public function test_different_date_is_mismatch(): void {
        $legacy = ['default' => $this->journal([['A', 5, 0], ['B', 0, 5]], '2026-11-12')];
        $engine = ['default' => $this->journal([['A', 5, 0], ['B', 0, 5]], '2026-11-13')];

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine)->status);
    }

    public function test_overall_status_takes_the_most_severe_purpose(): void {
        $match  = $this->journal([['A', 5, 0], ['B', 0, 5]]);
        $config = ['x' => $this->journal([['A', 7, 0], ['B', 0, 7]]), 'y' => $match];
        $engine = ['x' => $this->journal([['A', 7, 0], ['Z', 0, 7]]), 'y' => $this->journal([['A', 6, 0], ['B', 0, 5]])];

        // x = config_diff, y = rounding -> config_diff
        $this->assertSame(PostingParityLog::STATUS_CONFIG_DIFF, $this->comparator->compare($config, $engine, 'sales_invoice')->status);

        // tambah y mismatch -> mismatch
        $engine['y'] = $this->journal([['A', 99, 0], ['B', 0, 99]]);
        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($config, $engine, 'sales_invoice')->status);
    }

    public function test_both_sides_empty_is_a_match(): void {
        $this->assertSame(PostingParityLog::STATUS_MATCH, $this->comparator->compare([], [])->status);
    }

    public function test_swapped_sides_on_the_same_accounts_is_mismatch_not_config_diff(): void {
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['A', 0, 500], ['B', 500, 0]])];

        foreach (['sales_invoice', 'payment_entry', 'stock_entry', 'asset_value_adjustment', 'purchase_invoice', 'purchase_receipt'] as $type) {
            $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine, $type)->status, $type);
        }
    }

    public function test_account_permutation_is_mismatch_for_documents_without_user_chosen_accounts(): void {
        // Akun berbeda pada jurnal yang akunnya bukan pilihan pengguna (pencarian account_type / akun master).
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['A', 500, 0], ['C', 0, 500]])];

        foreach (['purchase_receipt', 'delivery_note', 'asset_depreciation', 'asset_scrap', 'asset_disposal'] as $type) {
            $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine, $type)->status, $type);
        }

        // Purchase Invoice: jurnal `stock` bukan pilihan pengguna, jurnal `expense` ya.
        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare(['stock' => $legacy['default']], ['stock' => $engine['default']], 'purchase_invoice')->status);
        $this->assertSame(PostingParityLog::STATUS_CONFIG_DIFF, $this->comparator->compare(['expense' => $legacy['default']], ['expense' => $engine['default']], 'purchase_invoice')->status);
    }

    public function test_purchase_invoice_stock_journal_with_different_account_is_mismatch_while_expense_is_config_diff(): void {
        $legacy = $this->journal([['S', 600, 0], ['R', 0, 600]]);
        $engine = $this->journal([['S', 600, 0], ['Z', 0, 600]]);

        $stock   = $this->comparator->compare(['stock' => $legacy], ['stock' => $engine], 'purchase_invoice');
        $expense = $this->comparator->compare(['expense' => $legacy], ['expense' => $engine], 'purchase_invoice');

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $stock->status);
        $this->assertSame(PostingParityLog::STATUS_CONFIG_DIFF, $expense->status);
        $this->assertSame(['R'], $expense->diff['expense']['legacy_accounts']);
        $this->assertSame(['Z'], $expense->diff['expense']['engine_accounts']);
    }

    public function test_permuting_two_shared_accounts_is_mismatch_even_for_user_chosen_documents(): void {
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['B', 500, 0], ['A', 0, 500]])];

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine, 'sales_invoice')->status);
    }

    public function test_config_diff_requires_the_unmatched_lines_to_carry_the_same_amounts(): void {
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['A', 500, 0], ['C', 0, 400]])];

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine, 'sales_invoice')->status);
    }

    public function test_without_a_document_type_account_differences_are_mismatch(): void {
        $legacy = ['default' => $this->journal([['A', 500, 0], ['B', 0, 500]])];
        $engine = ['default' => $this->journal([['A', 500, 0], ['C', 0, 500]])];

        $this->assertSame(PostingParityLog::STATUS_MISMATCH, $this->comparator->compare($legacy, $engine)->status);
    }
}
