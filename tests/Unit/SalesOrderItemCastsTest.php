<?php

namespace Tests\Unit;

use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Sales\SalesOrderItem;
use PHPUnit\Framework\TestCase;

class SalesOrderItemCastsTest extends TestCase {
    public function test_basic_amount_is_cast_to_float_on_sales_order_item(): void {
        $item = new SalesOrderItem;
        $item->setRawAttributes(['basic_amount' => '1.00', 'tax_amount' => '2.00', 'amount' => '3.00']);

        $this->assertIsFloat($item->basic_amount);
        $this->assertIsFloat($item->tax_amount);
        $this->assertIsFloat($item->amount);
    }

    public function test_basic_amount_is_cast_to_float_on_purchase_order_item(): void {
        $item = new PurchaseOrderItem;
        $item->setRawAttributes(['basic_amount' => '1.00', 'tax_amount' => '2.00', 'amount' => '3.00']);

        $this->assertIsFloat($item->basic_amount);
        $this->assertIsFloat($item->tax_amount);
        $this->assertIsFloat($item->amount);
    }

    public function test_basic_amount_is_cast_to_float_on_sales_invoice_item(): void {
        $item = new SalesInvoiceItem;
        $item->setRawAttributes(['basic_amount' => '1.00', 'tax_amount' => '2.00']);

        $this->assertIsFloat($item->basic_amount);
        $this->assertIsFloat($item->tax_amount);
    }

    public function test_basic_amount_is_cast_to_float_on_purchase_invoice_item(): void {
        $item = new PurchaseInvoiceItem;
        $item->setRawAttributes(['basic_amount' => '1.00', 'tax_amount' => '2.00', 'amount' => '3.00']);

        $this->assertIsFloat($item->basic_amount);
        $this->assertIsFloat($item->tax_amount);
        $this->assertIsFloat($item->amount);
    }

    public function test_string_amounts_no_longer_concatenate_when_summed(): void {
        // Root cause repro: uncast decimal/double columns arrive as strings from
        // MySQL/JSON; summing them with `+` in JS (see calculateArray in
        // resources/js/lib/utils.js) then concatenates instead of adding.
        // The `float` cast here is what guarantees PHP/JSON emits a number.
        $item = new SalesOrderItem;
        $item->setRawAttributes(['basic_amount' => '1']);
        $second = new SalesOrderItem;
        $second->setRawAttributes(['basic_amount' => '2']);

        $sum = $item->basic_amount + $second->basic_amount;

        $this->assertSame(3.0, $sum);
    }
}
