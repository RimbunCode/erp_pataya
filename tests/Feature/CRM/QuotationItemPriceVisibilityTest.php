<?php

namespace Tests\Feature\CRM;

use App\Enums\Permission;
use App\Models\CRM\Quotation;
use App\Models\CRM\QuotationItem;
use App\Services\Core\PermissionChecker;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionProperty;
use Tests\TestCase;

/**
 * basic_amount dan tax_amount dapat dipakai menghitung balik harga satuan
 * (basic_amount / quantity), jadi wajib dibatasi dengan izin yang sama seperti
 * price dan amount (design 2.4, daftar risiko).
 */
class QuotationItemPriceVisibilityTest extends TestCase {
    /**
     * @return array<string, mixed>
     */
    private function configColumns(): array {
        $property = new ReflectionProperty(new QuotationItem, 'configColumns');

        return $property->getValue(new QuotationItem);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function priceColumns(): array {
        return [
            'price'        => ['price'],
            'amount'       => ['amount'],
            'basic_amount' => ['basic_amount'],
            'tax_amount'   => ['tax_amount'],
        ];
    }

    /**
     * @param  array<int, string>  $granted
     */
    private function checkerWith(array $granted): PermissionChecker {
        $permissions = [];
        if ($granted !== []) {
            $permissions[Quotation::class] = [
                0 => [[
                    'model'        => Quotation::class,
                    'level'        => 0,
                    'only_creator' => false,
                    'permissions'  => array_fill_keys($granted, true),
                ]],
            ];
        }

        return new PermissionChecker($permissions);
    }

    #[DataProvider('priceColumns')]
    public function test_kolom_harga_dibatasi_izin_pembuat_quotation(string $column): void {
        $columns = $this->configColumns();

        $this->assertArrayHasKey($column, $columns);
        $this->assertArrayHasKey('visibleFor', $columns[$column], "{$column} harus punya visibleFor");

        [$model, $permissions] = $columns[$column]['visibleFor'][0];
        $this->assertSame(Quotation::class, $model);
        $this->assertContains(Permission::Write, $permissions);
        $this->assertContains(Permission::Create, $permissions);
    }

    public function test_basic_amount_dan_tax_amount_memakai_aturan_yang_sama_dengan_price(): void {
        $columns = $this->configColumns();

        $this->assertSame($columns['price']['visibleFor'], $columns['basic_amount']['visibleFor']);
        $this->assertSame($columns['price']['visibleFor'], $columns['tax_amount']['visibleFor']);
        $this->assertSame($columns['price']['visibleFor'], $columns['amount']['visibleFor']);
    }

    #[DataProvider('priceColumns')]
    public function test_peran_tanpa_izin_tidak_boleh_melihat_kolom_harga(string $column): void {
        $visibleFor = $this->configColumns()[$column]['visibleFor'];

        $this->assertFalse($this->checkerWith([])->satisfies($visibleFor));
    }

    #[DataProvider('priceColumns')]
    public function test_peran_yang_hanya_bisa_membaca_tidak_boleh_melihat_kolom_harga(string $column): void {
        $visibleFor = $this->configColumns()[$column]['visibleFor'];

        $this->assertFalse($this->checkerWith(['select', 'read', 'print'])->satisfies($visibleFor));
    }

    #[DataProvider('priceColumns')]
    public function test_pembuat_quotation_boleh_melihat_kolom_harga(string $column): void {
        $visibleFor = $this->configColumns()[$column]['visibleFor'];

        $this->assertTrue($this->checkerWith(['write'])->satisfies($visibleFor));
        $this->assertTrue($this->checkerWith(['create'])->satisfies($visibleFor));
    }

    public function test_kolom_non_harga_tidak_dibatasi(): void {
        $columns = $this->configColumns();

        foreach (['item', 'description', 'quantity', 'remark', 'itemUnit', 'tax'] as $column) {
            $this->assertArrayNotHasKey('visibleFor', $columns[$column] ?? [], $column);
        }
    }
}
