<?php

namespace Tests\Unit;

use App\Services\Finances\DocumentDiscountCalculator;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DocumentDiscountCalculatorTest extends TestCase {
    /**
     * Fixture baku dari requirements.md Part 5: line 1 = 10x100.000 @ PPN 11%,
     * line 2 = 5x200.000 @ 10%.
     *
     * @return array<int, array{basic_amount: float, tax_rate: float}>
     */
    private function fixtureLines(): array {
        return [
            ['basic_amount' => 10 * 100000, 'tax_rate' => 11],
            ['basic_amount' => 5 * 200000, 'tax_rate' => 10],
        ];
    }

    private function sumDpp(array $result): float {
        return round(array_sum(array_column($result, 'basic_amount')), 2);
    }

    private function sumTax(array $result): float {
        return round(array_sum(array_column($result, 'tax_amount')), 2);
    }

    private function sumTotal(array $result): float {
        return round(array_sum(array_column($result, 'amount')), 2);
    }

    private function assertInvariants(array $result): void {
        $dpp   = $this->sumDpp($result);
        $tax   = $this->sumTax($result);
        $total = $this->sumTotal($result);

        $this->assertEqualsWithDelta($dpp + $tax, $total, 0.01, 'Total == DPP + Tax');
        foreach ($result as $line) {
            $this->assertEqualsWithDelta($line['basic_amount'] + $line['tax_amount'], $line['amount'], 0.01);
        }
    }

    public function test_case_a_no_discount(): void {
        $result = DocumentDiscountCalculator::allocate($this->fixtureLines(), null, 0, 0);

        $this->assertEqualsWithDelta(2000000, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(210000, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(2210000, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
    }

    public function test_case_b_ten_percent_on_net_total(): void {
        $result = DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            10,
            0,
            'discount_rate',
        );

        $this->assertEqualsWithDelta(1800000, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(189000, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(1989000, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
    }

    public function test_case_c_ten_percent_on_grand_total(): void {
        $result = DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_GRAND_TOTAL,
            10,
            0,
            'discount_rate',
        );

        $this->assertEqualsWithDelta(1800000, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(189000, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(1989000, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
    }

    public function test_case_b_and_c_totals_match_linearity_property(): void {
        $b = DocumentDiscountCalculator::allocate($this->fixtureLines(), DocumentDiscountCalculator::BASIS_NET_TOTAL, 10, 0, 'discount_rate');
        $c = DocumentDiscountCalculator::allocate($this->fixtureLines(), DocumentDiscountCalculator::BASIS_GRAND_TOTAL, 10, 0, 'discount_rate');

        $this->assertEqualsWithDelta($this->sumTotal($b), $this->sumTotal($c), 0.01, 'Case B dan C harus hasilkan Total yang sama untuk diskon persentase');
    }

    public function test_case_d_fixed_200000_on_net_total(): void {
        $result = DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            0,
            200000,
            'discount_amount',
        );

        $this->assertEqualsWithDelta(1800000, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(189000, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(1989000, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
    }

    public function test_case_e_fixed_221000_on_grand_total(): void {
        $result = DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_GRAND_TOTAL,
            0,
            221000,
            'discount_amount',
        );

        $this->assertEqualsWithDelta(1800000, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(189000, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(1989000, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
    }

    public function test_case_f_hundred_percent_discount_on_net_total(): void {
        $result = DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            100,
            0,
            'discount_rate',
        );

        $this->assertEqualsWithDelta(0, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(0, $this->sumTax($result), 0.01);
        $this->assertEqualsWithDelta(0, $this->sumTotal($result), 0.01);
        $this->assertInvariants($result);
        foreach ($result as $line) {
            $this->assertGreaterThanOrEqual(0, $line['basic_amount']);
            $this->assertGreaterThanOrEqual(0, $line['tax_amount']);
        }
    }

    public function test_discount_exceeding_basis_is_rejected(): void {
        $this->expectException(ValidationException::class);

        DocumentDiscountCalculator::allocate(
            $this->fixtureLines(),
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            0,
            5000000,
            'discount_amount',
        );
    }

    public function test_rounding_residual_preserves_invariant_on_uneven_split(): void {
        // Diskon 33% pada 3 baris tidak habis dibagi rata ke 2 desimal -- kasus ini
        // yang membuktikan residual rounding bekerja, bukan cuma round() polos per baris.
        $lines = [
            ['basic_amount' => 100000, 'tax_rate' => 11],
            ['basic_amount' => 100000, 'tax_rate' => 11],
            ['basic_amount' => 100000, 'tax_rate' => 11],
        ];

        $result = DocumentDiscountCalculator::allocate(
            $lines,
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            33,
            0,
            'discount_rate',
        );

        $this->assertEqualsWithDelta(201000, $this->sumDpp($result), 0.01, 'DPP = 300.000 - 33% = 201.000');
        $this->assertInvariants($result);
    }

    public function test_zero_basic_amount_lines_do_not_divide_by_zero(): void {
        $lines = [
            ['basic_amount' => 0, 'tax_rate' => 11],
            ['basic_amount' => 0, 'tax_rate' => 11],
        ];

        $result = DocumentDiscountCalculator::allocate(
            $lines,
            DocumentDiscountCalculator::BASIS_NET_TOTAL,
            10,
            0,
            'discount_rate',
        );

        $this->assertEqualsWithDelta(0, $this->sumDpp($result), 0.01);
        $this->assertEqualsWithDelta(0, $this->sumTax($result), 0.01);
    }

    public function test_no_discount_basis_returns_lines_unchanged(): void {
        $result = DocumentDiscountCalculator::allocate($this->fixtureLines(), null, 10, 500000, 'discount_rate');

        $this->assertEqualsWithDelta(2000000, $this->sumDpp($result), 0.01, 'discount_on null berarti tidak ada diskon diterapkan sama sekali');
        $this->assertEqualsWithDelta(210000, $this->sumTax($result), 0.01);
    }
}
