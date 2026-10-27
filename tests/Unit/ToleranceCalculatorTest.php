<?php

namespace Tests\Unit;

use App\Services\Core\Setting\ToleranceCalculator;
use PHPUnit\Framework\TestCase;

class ToleranceCalculatorTest extends TestCase {
    public function test_null_tolerance_is_unrestricted(): void {
        $calculator = new ToleranceCalculator;

        $this->assertNull($calculator->allowed(12, 3, null));
        $this->assertFalse($calculator->exceeds(1000, 12, 3, null));
    }

    public function test_zero_tolerance_is_strict_and_positive_tolerance_extends_source_limit(): void {
        $calculator = new ToleranceCalculator;

        $this->assertSame(9.0, $calculator->allowed(12, 3, 0));
        $this->assertEqualsWithDelta(10.2, $calculator->allowed(12, 3, 10), 0.000001);
        $this->assertFalse($calculator->exceeds(10.2, 12, 3, 10));
        $this->assertTrue($calculator->exceeds(10.2002, 12, 3, 10));
    }

    public function test_used_quantity_cannot_make_remaining_allowance_negative(): void {
        $calculator = new ToleranceCalculator;

        $this->assertSame(0.0, $calculator->allowed(12, 20, 10));
    }

    public function test_invoice_value_uses_the_same_cumulative_tolerance_rule(): void {
        $calculator = new ToleranceCalculator;

        $this->assertFalse($calculator->exceedsValue(0, 1200, 1200, null));
        $this->assertFalse($calculator->exceedsValue(120, 1200, 1200, 10));
        $this->assertTrue($calculator->exceedsValue(120.01, 1200, 1200, 10));
    }
}
