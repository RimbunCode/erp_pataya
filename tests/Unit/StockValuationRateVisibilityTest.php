<?php

namespace Tests\Unit;

use App\Enums\Permission;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

class StockValuationRateVisibilityTest extends TestCase {
    public function test_valuation_rate_is_gated_by_stock_entry_write_or_create_permission(): void {
        $configColumns = $this->readConfigColumns(new Stock);

        $this->assertArrayHasKey('valuation_rate', $configColumns, 'valuation_rate harus terdaftar di configColumns Stock');
        $this->assertArrayHasKey('visibleFor', $configColumns['valuation_rate'], 'valuation_rate harus punya gate visibleFor');

        $visibleFor = $configColumns['valuation_rate']['visibleFor'];

        $this->assertCount(1, $visibleFor);
        [$model, $permissions] = $visibleFor[0];

        $this->assertSame(StockEntry::class, $model);
        $this->assertContains(Permission::Write, $permissions);
        $this->assertContains(Permission::Create, $permissions);
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
