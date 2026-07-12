<?php

namespace Tests\Unit\Services\Handlebar;

use App\Services\Handlebar\FormatHelperService;
use PHPUnit\Framework\TestCase;

class FormatHelperServiceTest extends TestCase {
    protected FormatHelperService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new FormatHelperService;
    }

    public function test_format_currency_formats_indonesian_style_with_symbol(): void {
        $this->assertSame('Rp 1.000.000,00', $this->service->formatCurrency(1000000, 'IDR'));
    }

    public function test_format_currency_falls_back_to_code_for_unknown_currency(): void {
        $this->assertSame('XYZ 500,00', $this->service->formatCurrency(500, 'xyz'));
    }

    public function test_format_currency_returns_empty_string_for_empty_value(): void {
        $this->assertSame('', $this->service->formatCurrency('', 'IDR'));
        $this->assertSame('', $this->service->formatCurrency(null, 'IDR'));
    }

    public function test_format_number_formats_with_given_decimal_scale(): void {
        $this->assertSame('1.234.567,89', $this->service->formatNumber(1234567.891, 2));
    }

    public function test_format_number_rounds_half_up(): void {
        $this->assertSame('1,01', $this->service->formatNumber(1.005, 2));
    }

    public function test_format_number_handles_negative_values(): void {
        $this->assertSame('-1.000,00', $this->service->formatNumber(-1000, 2));
    }

    public function test_format_date_converts_js_style_tokens(): void {
        $this->assertSame('15/01/2026', $this->service->formatDate('2026-01-15', 'DD/MM/YYYY'));
    }

    public function test_format_date_returns_empty_string_for_empty_value(): void {
        $this->assertSame('', $this->service->formatDate('', 'DD/MM/YYYY'));
        $this->assertSame('', $this->service->formatDate(null, 'DD/MM/YYYY'));
    }
}
