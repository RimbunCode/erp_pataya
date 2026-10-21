<?php

namespace Tests\Unit;

use App\Services\Core\Setting\RateChangeComparator;
use PHPUnit\Framework\TestCase;

class RateChangeComparatorTest extends TestCase {
    public function test_equal_base_unit_rates_are_not_a_change_across_currencies_or_units(): void {
        $comparator = new RateChangeComparator;

        $this->assertFalse($comparator->hasChanged(20, 2, 2, 40, 1, 2));
    }

    public function test_different_base_unit_rates_are_detected(): void {
        $comparator = new RateChangeComparator;

        $this->assertTrue($comparator->hasChanged(100, 1, 1, 101, 1, 1));
    }
}
