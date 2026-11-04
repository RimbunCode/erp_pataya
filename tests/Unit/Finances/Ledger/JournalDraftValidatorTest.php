<?php

namespace Tests\Unit\Finances\Ledger;

use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalDraftValidator;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\MinorUnit;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 4.4 (bagian P-1) dan Requirement 2.3-2.5. Validasi murni tanpa database: 1.000 draft acak yang
 * seimbang dalam minor unit diterima dan 1.000 draft tak seimbang ditolak dengan selisih yang tepat (seed tetap,
 * pola `mt_srand` seperti test lain di repo).
 */
class JournalDraftValidatorTest extends TestCase {
    private const SEED = 20261104;

    private function draft(array $lines): JournalDraft {
        return new JournalDraft(CarbonImmutable::parse('2026-11-04 10:00:00'), $lines);
    }

    private function line(float|int|string $debit, float|int|string $credit, string $account = 'A'): JournalLineDraft {
        return new JournalLineDraft($account, $debit, $credit);
    }

    /**
     * @return list<int>
     */
    private function partition(int $total, int $parts): array {
        if ($parts === 1) {
            return [$total];
        }

        $cuts = [];
        while (\count($cuts) < $parts - 1) {
            $cuts[mt_rand(1, $total - 1)] = true;
        }
        $cuts = array_keys($cuts);
        sort($cuts);

        $result   = [];
        $previous = 0;
        foreach ($cuts as $cut) {
            $result[] = $cut - $previous;
            $previous = $cut;
        }
        $result[] = $total - $previous;

        return $result;
    }

    /**
     * Nilai desimal yang pembulatan HALF_UP-nya kembali ke `$minor`: derau kurang dari 0,4 minor unit, dan
     * representasinya diacak antara float dan string.
     */
    private function represent(int $minor, int $minorUnit): float|string {
        $noise = (mt_rand(-399, 399) / 1000);
        $value = ($minor + $noise) / (10 ** $minorUnit);

        return mt_rand(0, 1) === 1 ? $value : sprintf('%.8F', $value);
    }

    /**
     * Draft seimbang dalam minor unit: tiap baris satu sisi. Mengembalikan baris dan sisi tiap baris.
     *
     * @return array{0: list<array{side: string, minor: int}>, 1: int}
     */
    private function randomBalancedShape(): array {
        $lineCount   = mt_rand(2, 7);
        $debitCount  = mt_rand(1, $lineCount - 1);
        $creditCount = $lineCount - $debitCount;
        $total       = mt_rand($lineCount, 5_000_000);

        $shape = [];
        foreach ($this->partition($total, $debitCount) as $minor) {
            $shape[] = ['side' => 'debit', 'minor' => $minor];
        }
        foreach ($this->partition($total, $creditCount) as $minor) {
            $shape[] = ['side' => 'credit', 'minor' => $minor];
        }
        shuffle($shape);

        return [$shape, $total];
    }

    /**
     * @param  list<array{side: string, minor: int}>  $shape
     */
    private function toDraft(array $shape, int $minorUnit): JournalDraft {
        $lines = [];
        foreach ($shape as $index => $item) {
            $amount  = $this->represent($item['minor'], $minorUnit);
            $lines[] = $this->line($item['side'] === 'debit' ? $amount : 0, $item['side'] === 'credit' ? $amount : 0, "acc-{$index}");
        }

        return $this->draft($lines);
    }

    public function test_p1_one_thousand_balanced_drafts_are_accepted(): void {
        mt_srand(self::SEED);

        foreach ([2 => 1000, 0 => 150, 3 => 150] as $minorUnit => $iterations) {
            for ($i = 0; $i < $iterations; $i++) {
                [$shape, $total] = $this->randomBalancedShape();
                $normalized      = JournalDraftValidator::validate($this->toDraft($shape, $minorUnit), $minorUnit);

                $this->assertSame($total, $normalized->totalMinor);
                $this->assertSame($total, array_sum(array_map(fn ($line) => $line->debitMinor, $normalized->lines)));
                $this->assertSame($total, array_sum(array_map(fn ($line) => $line->creditMinor, $normalized->lines)));
                $this->assertSame(range(1, \count($shape)), array_map(fn ($line) => $line->lineNo, $normalized->lines));
            }
        }
    }

    public function test_p1_one_thousand_unbalanced_drafts_are_rejected_with_the_exact_difference(): void {
        mt_srand(self::SEED + 1);

        foreach ([2 => 1000, 0 => 150, 3 => 150] as $minorUnit => $iterations) {
            for ($i = 0; $i < $iterations; $i++) {
                [$shape] = $this->randomBalancedShape();

                $victim = mt_rand(0, \count($shape) - 1);
                $delta  = mt_rand(1, 1000);
                if (mt_rand(0, 1) === 1 && $shape[$victim]['minor'] > $delta) {
                    $delta = -$delta;
                }
                $shape[$victim]['minor'] += $delta;
                $expectedDifference = $shape[$victim]['side'] === 'debit' ? $delta : -$delta;

                try {
                    JournalDraftValidator::validate($this->toDraft($shape, $minorUnit), $minorUnit);
                    $this->fail('Draft tak seimbang harus ditolak.');
                } catch (UnbalancedJournalException $e) {
                    $this->assertSame($expectedDifference, $e->differenceMinor);
                    $this->assertSame($minorUnit, $e->minorUnit);
                }
            }
        }
    }

    public function test_fewer_than_two_lines_is_rejected(): void {
        foreach ([[], [$this->line(10, 0)]] as $lines) {
            try {
                JournalDraftValidator::validate($this->draft($lines), 2);
                $this->fail('Kurang dari 2 baris harus ditolak.');
            } catch (InvalidJournalException $e) {
                $this->assertStringContainsString((string) \count($lines), $e->getMessage());
            }
        }
    }

    public function test_negative_both_sided_and_empty_lines_are_rejected(): void {
        $cases = [
            'debit negatif'       => [$this->line(-5, 0), $this->line(0, 5)],
            'kredit negatif'      => [$this->line(5, 0), $this->line(0, -5)],
            'dua sisi bernilai'   => [$this->line(5, 5), $this->line(0, 5)],
            'dua sisi nol'        => [$this->line(0, 0), $this->line(5, 0)],
            'dua sisi hampir nol' => [$this->line(0.004, 0), $this->line(0, 5)],
            'negatif kecil'       => [$this->line(-0.001, 0), $this->line(0, 5)],
        ];

        foreach ($cases as $label => $lines) {
            try {
                JournalDraftValidator::validate($this->draft($lines), 2);
                $this->fail("Kasus '{$label}' harus ditolak.");
            } catch (InvalidJournalException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_non_numeric_and_out_of_range_amounts_are_rejected(): void {
        foreach ([
            'bukan angka'   => [$this->line('abc', 0), $this->line(0, 5)],
            'INF'           => [$this->line(INF, 0), $this->line(0, 5)],
            'terlalu besar' => [$this->line(9.1e13, 0), $this->line(0, 9.1e13)],
        ] as $label => $lines) {
            try {
                JournalDraftValidator::validate($this->draft($lines), 2);
                $this->fail("Kasus '{$label}' harus ditolak.");
            } catch (InvalidJournalException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_amounts_are_rounded_before_the_balance_check(): void {
        // 100.4 dan 100.0 sama-sama menjadi 100 pada minor unit 0 (JPY).
        $normalized = JournalDraftValidator::validate($this->draft([$this->line(100.4, 0), $this->line(0, 100.0)]), 0);
        $this->assertSame(100, $normalized->totalMinor);

        // 10.005 dan 10.01 sama-sama menjadi 10.01 pada 2 desimal (HALF_UP).
        $normalized = JournalDraftValidator::validate($this->draft([$this->line(10.005, 0), $this->line(0, 10.01)]), 2);
        $this->assertSame(1001, $normalized->totalMinor);

        // 0.1 + 0.2 pada sisi debit melawan 0.3 pada sisi kredit seimbang walau float tidak sama persis.
        $normalized = JournalDraftValidator::validate($this->draft([$this->line(0.1, 0), $this->line(0.2, 0), $this->line(0, 0.3)]), 2);
        $this->assertSame(30, $normalized->totalMinor);
    }

    public function test_difference_is_reported_in_decimal_units(): void {
        try {
            JournalDraftValidator::validate($this->draft([$this->line(100, 0), $this->line(0, 99.5)]), 2);
            $this->fail('Harus tidak seimbang.');
        } catch (UnbalancedJournalException $e) {
            $this->assertSame(50, $e->differenceMinor);
            $this->assertStringContainsString(MinorUnit::fromMinor(50, 2), $e->getMessage());
        }
    }
}
