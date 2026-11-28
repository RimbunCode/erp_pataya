<?php

namespace Tests\Unit;

use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Finances\DocumentDiscountCalculator;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * Alokasi diskon dokumen dengan pajak majemuk per item (spek finance-multi-tax-per-item, Requirement 4): pajak awal
 * baris = Σ pajak penambah, reduksi `grand_total` memakai Σ tarif penambah, pajak potong tidak ikut basis, dan bentuk
 * satu pajak lama menghasilkan angka identik.
 */
class DocumentDiscountCalculatorMultiTaxTest extends TestCase {
    /** @param array<string, mixed> $tax */
    private function line(float $basic, array ...$taxes): array {
        return ['basic_amount' => $basic, 'tax_rate' => 0, 'taxes' => $taxes];
    }

    public function test_a_single_element_taxes_list_is_identical_to_the_legacy_single_tax_shape(): void {
        foreach ([DocumentDiscountCalculator::BASIS_NET_TOTAL, DocumentDiscountCalculator::BASIS_GRAND_TOTAL, null] as $basis) {
            $legacy = DocumentDiscountCalculator::allocate([
                ['basic_amount' => 1_000_000.0, 'tax_rate' => 12.0, 'dpp_factor' => 11 / 12, 'additive' => true],
                ['basic_amount' => 333_333.33, 'tax_rate' => 11.0, 'dpp_factor' => 1.0, 'additive' => true],
            ], $basis, 0, 123_456.78, 'discount_amount', 1.0);

            $listed = DocumentDiscountCalculator::allocate([
                $this->line(1_000_000.0, ['rate' => 12.0, 'dpp_factor' => 11 / 12, 'additive' => true]),
                $this->line(333_333.33, ['rate' => 11.0, 'dpp_factor' => 1.0, 'additive' => true]),
            ], $basis, 0, 123_456.78, 'discount_amount', 1.0);

            $this->assertSame($legacy, $listed, 'Satu elemen taxes identik dengan bentuk lama (basis ' . ($basis ?? 'tanpa diskon') . ').');
        }
    }

    public function test_pre_tax_is_the_sum_of_additive_taxes_and_withholding_is_excluded(): void {
        $result = DocumentDiscountCalculator::allocate([
            $this->line(
                1_000_000.0,
                ['rate' => 12.0, 'dpp_factor' => 11 / 12, 'additive' => true],
                ['rate' => 10.0, 'dpp_factor' => 1.0, 'additive' => true],
                ['rate' => 2.0, 'dpp_factor' => 1.0, 'additive' => false],
            ),
        ], null, 0, 0);

        // 1.000.000 x 11/12 x 12% = 110.000; 1.000.000 x 10% = 100.000; PPh tidak menambah.
        $this->assertEqualsWithDelta(210_000, $result[0]['tax_amount'], 0.01);
        $this->assertEqualsWithDelta(1_210_000, $result[0]['amount'], 0.01);
    }

    public function test_net_total_basis_is_not_affected_by_the_number_of_taxes(): void {
        $one = DocumentDiscountCalculator::allocate([
            $this->line(1_000_000.0, ['rate' => 12.0, 'dpp_factor' => 1.0, 'additive' => true]),
            $this->line(500_000.0, ['rate' => 12.0, 'dpp_factor' => 1.0, 'additive' => true]),
        ], DocumentDiscountCalculator::BASIS_NET_TOTAL, 0, 150_000, 'discount_amount');

        $many = DocumentDiscountCalculator::allocate([
            $this->line(1_000_000.0, ['rate' => 12.0, 'dpp_factor' => 1.0, 'additive' => true], ['rate' => 10.0, 'dpp_factor' => 1.0, 'additive' => true], ['rate' => 2.0, 'dpp_factor' => 1.0, 'additive' => false]),
            $this->line(500_000.0, ['rate' => 12.0, 'dpp_factor' => 1.0, 'additive' => true]),
        ], DocumentDiscountCalculator::BASIS_NET_TOTAL, 0, 150_000, 'discount_amount');

        $this->assertSame(array_column($one, 'basic_amount'), array_column($many, 'basic_amount'), 'Diskon net_total tidak bergantung pada pajak.');
    }

    public function test_grand_total_reduction_uses_the_sum_of_additive_rates(): void {
        $result = DocumentDiscountCalculator::allocate([
            $this->line(1_000_000.0, ['rate' => 10.0, 'dpp_factor' => 1.0, 'additive' => true], ['rate' => 5.0, 'dpp_factor' => 1.0, 'additive' => true], ['rate' => 2.0, 'dpp_factor' => 1.0, 'additive' => false]),
        ], DocumentDiscountCalculator::BASIS_GRAND_TOTAL, 0, 115_000, 'discount_amount', 1.0);

        // Gross = 1.000.000 x (1 + 0,15) = 1.150.000; diskon 115.000 seluruhnya pada baris itu; reduksi = 115.000 / 1,15.
        $this->assertEqualsWithDelta(900_000, $result[0]['basic_amount'], 0.01);
        $this->assertEqualsWithDelta(135_000, $result[0]['tax_amount'], 0.01, '900.000 x 15%.');
    }

    public function test_invoice_item_discounts_build_the_taxes_list_only_for_two_or_more_taxes(): void {
        $document = new SalesInvoice;
        $document->setAttribute('discount_on', DocumentDiscountCalculator::BASIS_GRAND_TOTAL);
        $document->setAttribute('discount_rate', 0);
        $document->setAttribute('discount_amount', 100_000);
        $multi  = $this->item('i1', 1_000_000, 'ppn');
        $single = $this->item('i2', 1_000_000, 'ppn');
        $rules  = [
            'ppn' => ['rate' => 12.0, 'dpp_factor' => 1.0, 'additive' => true],
            'pph' => ['rate' => 2.0, 'dpp_factor' => 1.0, 'additive' => false],
        ];

        $legacy = DocumentDiscountCalculator::invoiceItemDiscounts($document, new Collection([$single]), $rules);
        $viaMap = DocumentDiscountCalculator::invoiceItemDiscounts($document, new Collection([$single]), $rules, ['i2' => ['ppn']]);
        $this->assertSame($legacy, $viaMap, 'Peta itemTaxIds satu pajak = bentuk lama.');

        $both  = DocumentDiscountCalculator::invoiceItemDiscounts($document, new Collection([$multi, $single]), $rules, ['i1' => ['ppn', 'pph'], 'i2' => ['ppn']]);
        $plain = DocumentDiscountCalculator::invoiceItemDiscounts($document, new Collection([$multi, $single]), $rules, ['i1' => ['ppn'], 'i2' => ['ppn']]);
        $this->assertSame($plain, $both, 'Pajak potong tidak mengubah alokasi diskon grand_total.');
    }

    private function item(string $id, float $basic, string $taxId): SalesInvoiceItem {
        $item = new SalesInvoiceItem;
        $item->setAttribute('id', $id);
        $item->setAttribute('tax_id', $taxId);
        $item->setAttribute('basic_amount', $basic);

        return $item;
    }
}
