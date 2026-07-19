<?php

namespace Tests\Unit;

use App\Enums\Permission;
use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationItem;
use App\Models\Finances\AdditionalCost;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockEntryItem;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/**
 * Audit lanjutan (Perbaikan 4 plan MoM): kolom harga/HPP yang ditemukan
 * belum dilindungi visibleFor, atau belum terdaftar sama sekali di
 * configColumns. Lihat juga StockValuationRateVisibilityTest.php untuk
 * Stock::valuation_rate yang diperbaiki lebih dulu.
 */
class PriceColumnVisibilityAuditTest extends TestCase {
    public function test_quotation_item_price_and_amount_are_gated_by_quotation_permission(): void {
        $configColumns = $this->readConfigColumns(new QuotationItem);

        foreach (['price', 'amount'] as $column) {
            $this->assertArrayHasKey($column, $configColumns);
            $this->assertArrayHasKey('visibleFor', $configColumns[$column], "{$column} harus punya visibleFor");

            [$model, $permissions] = $configColumns[$column]['visibleFor'][0];
            $this->assertSame(Quotation::class, $model);
            $this->assertContains(Permission::Write, $permissions);
            $this->assertContains(Permission::Create, $permissions);
        }
    }

    public function test_stock_entry_item_rate_columns_are_gated_by_stock_entry_permission(): void {
        $configColumns = $this->readConfigColumns(new StockEntryItem);

        foreach (['basic_rate', 'additional_cost', 'valuation_rate', 'basic_amount', 'amount'] as $column) {
            $this->assertArrayHasKey($column, $configColumns, "{$column} harus terdaftar di configColumns");
            $this->assertArrayHasKey('visibleFor', $configColumns[$column], "{$column} harus punya visibleFor");

            [$model, $permissions] = $configColumns[$column]['visibleFor'][0];
            $this->assertSame(StockEntry::class, $model);
            $this->assertContains(Permission::Write, $permissions);
            $this->assertContains(Permission::Create, $permissions);
        }
    }

    public function test_delivery_note_item_valuation_rates_is_hidden_not_visible_for(): void {
        $configColumns = $this->readConfigColumns(new DeliveryNoteItem);

        $this->assertArrayHasKey('valuation_rates', $configColumns);
        $this->assertTrue($configColumns['valuation_rates']['ignore'] ?? false, 'valuation_rates harus ignore (data internal, bukan kolom yang ditampilkan)');
    }

    public function test_additional_cost_typo_property_is_fixed_and_amount_is_gated(): void {
        $model = new AdditionalCost;

        // Property harus bernama configColumns (bukan confgiColumns) agar terbaca LinkModel trait.
        $this->assertTrue(property_exists($model, 'configColumns'));

        $configColumns = $this->readConfigColumns($model);

        $this->assertArrayHasKey('amount', $configColumns);
        $this->assertArrayHasKey('visibleFor', $configColumns['amount']);

        [$gateModel, $permissions] = $configColumns['amount']['visibleFor'][0];
        $this->assertSame(StockEntry::class, $gateModel);
        $this->assertContains(Permission::Write, $permissions);
        $this->assertContains(Permission::Create, $permissions);
    }

    public function test_stock_valuation_rate_still_gated_after_related_changes(): void {
        // Regression guard sederhana: pastikan perubahan di sekitar StockEntryItem
        // tidak mengubah/menghapus proteksi Stock::valuation_rate yang sudah ada.
        $configColumns = $this->readConfigColumns(new Stock);

        $this->assertArrayHasKey('valuation_rate', $configColumns);
        $this->assertArrayHasKey('visibleFor', $configColumns['valuation_rate']);
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
