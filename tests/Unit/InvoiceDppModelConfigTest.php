<?php

namespace Tests\Unit;

use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoiceItem;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

class InvoiceDppModelConfigTest extends TestCase {
    public function test_dpp_amount_is_cast_to_float_on_sales_invoice_item(): void {
        $item = new SalesInvoiceItem;
        $item->setRawAttributes(['dpp_amount' => '1.00', 'basic_amount' => '2.00', 'tax_amount' => '3.00']);

        $this->assertIsFloat($item->dpp_amount);
    }

    public function test_dpp_amount_is_cast_to_float_on_purchase_invoice_item(): void {
        $item = new PurchaseInvoiceItem;
        $item->setRawAttributes(['dpp_amount' => '1.00', 'basic_amount' => '2.00', 'tax_amount' => '3.00', 'amount' => '5.00']);

        $this->assertIsFloat($item->dpp_amount);
    }

    public function test_dpp_amount_is_exposed_in_config_columns_with_price_visibility_on_sales_invoice_item(): void {
        $configColumns = $this->readConfigColumns(new SalesInvoiceItem);

        $this->assertArrayHasKey('dpp_amount', $configColumns);
        $this->assertSame('currency', $configColumns['dpp_amount']['type']);
        $this->assertTrue($configColumns['dpp_amount']['show']);
        $this->assertArrayHasKey('visibleFor', $configColumns['dpp_amount']);
        $this->assertSame($configColumns['basic_amount']['visibleFor'], $configColumns['dpp_amount']['visibleFor']);
    }

    public function test_dpp_amount_is_exposed_in_config_columns_with_price_visibility_on_purchase_invoice_item(): void {
        $configColumns = $this->readConfigColumns(new PurchaseInvoiceItem);

        $this->assertArrayHasKey('dpp_amount', $configColumns);
        $this->assertSame('currency', $configColumns['dpp_amount']['type']);
        $this->assertTrue($configColumns['dpp_amount']['show']);
        $this->assertArrayHasKey('visibleFor', $configColumns['dpp_amount']);
        $this->assertSame($configColumns['basic_amount']['visibleFor'], $configColumns['dpp_amount']['visibleFor']);
    }

    /**
     * @return array<string, mixed>
     */
    private function readConfigColumns(object $model): array {
        $property = new ReflectionProperty($model, 'configColumns');
        $property->setAccessible(true);

        return $property->getValue($model);
    }
}
