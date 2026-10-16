<?php

namespace Tests\Unit\Finances;

use App\Models\Finances\SalesInvoice;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

class SalesInvoiceCurrencyColumnsTest extends TestCase {
    public function test_total_amount_columns_are_currency(): void {
        $property = new ReflectionProperty(SalesInvoice::class, 'configColumns');
        $columns  = $property->getValue(new SalesInvoice);

        foreach (['amount', 'paid_amount', 'outstanding_amount', 'discount_amount'] as $field) {
            $this->assertSame('currency', $columns[$field]['type']);
        }
    }
}
