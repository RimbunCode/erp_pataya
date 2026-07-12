<?php

namespace Tests\Unit\Services\Handlebar;

use App\Services\Handlebar\ArithmeticHelperService;
use PHPUnit\Framework\TestCase;

class ArithmeticHelperServiceTest extends TestCase {
    protected ArithmeticHelperService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new ArithmeticHelperService;
    }

    public function test_multiply_multiplies_two_numeric_values(): void {
        $this->assertSame(50.0, $this->service->multiply(5, '10'));
    }

    public function test_multiply_returns_zero_for_non_numeric_input(): void {
        $this->assertSame(0.0, $this->service->multiply('abc', 5));
    }

    public function test_subtract_subtracts_second_from_first(): void {
        $this->assertSame(7.0, $this->service->subtract(10, 3));
    }

    public function test_subtract_returns_first_when_second_missing(): void {
        $this->assertSame(10.0, $this->service->subtract(10, 'abc'));
    }

    public function test_add_adds_two_values(): void {
        $this->assertSame(15.0, $this->service->add(10, 5));
    }

    public function test_divide_divides_first_by_second(): void {
        $this->assertSame(5.0, $this->service->divide(10, 2));
    }

    public function test_divide_by_zero_returns_zero(): void {
        $this->assertSame(0.0, $this->service->divide(10, 0));
    }
}
