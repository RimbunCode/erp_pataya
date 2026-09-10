<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Category;
use App\Services\Inventory\ItemServices;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * ItemServices::applyCategoryDerivedFields() menegakkan dua aturan bisnis:
 * kategori jasa tidak bisa jadi aset tetap, dan aset tetap tidak pernah
 * tercatat sebagai barang stok. Dipanggil dari ItemController::store()/update().
 */
class ItemServicesCategoryDerivedFieldsTest extends TestCase {
    use RefreshDatabase;

    private function makeCategory(string $type): Category {
        return Category::factory()->create(['type' => $type]);
    }

    #[Test]
    public function kategori_non_service_tanpa_fixed_asset_menghasilkan_stock_item_true(): void {
        $category = $this->makeCategory('inventory');
        $service  = new ItemServices;

        $result = $service->applyCategoryDerivedFields(['is_fixed_asset' => false], $category);

        $this->assertFalse($result['is_fixed_asset']);
        $this->assertTrue($result['is_stock_item']);
        $this->assertSame('inventory', $result['type']);
    }

    #[Test]
    public function kategori_non_service_dengan_fixed_asset_true_membuat_stock_item_false(): void {
        $category = $this->makeCategory('vehicle');
        $service  = new ItemServices;

        $result = $service->applyCategoryDerivedFields(['is_fixed_asset' => true], $category);

        $this->assertTrue($result['is_fixed_asset']);
        $this->assertFalse($result['is_stock_item']);
    }

    #[Test]
    public function kategori_service_memaksa_fixed_asset_false_walau_diminta_true(): void {
        $category = $this->makeCategory('service');
        $service  = new ItemServices;

        $result = $service->applyCategoryDerivedFields(['is_fixed_asset' => true], $category);

        $this->assertFalse($result['is_fixed_asset']);
        $this->assertFalse($result['is_stock_item']);
    }

    #[Test]
    public function kategori_service_tanpa_fixed_asset_tetap_stock_item_false(): void {
        $category = $this->makeCategory('service');
        $service  = new ItemServices;

        $result = $service->applyCategoryDerivedFields(['is_fixed_asset' => false], $category);

        $this->assertFalse($result['is_fixed_asset']);
        $this->assertFalse($result['is_stock_item']);
    }

    #[Test]
    public function is_fixed_asset_tidak_diberikan_di_data_dianggap_false(): void {
        $category = $this->makeCategory('inventory');
        $service  = new ItemServices;

        $result = $service->applyCategoryDerivedFields([], $category);

        $this->assertFalse($result['is_fixed_asset']);
        $this->assertTrue($result['is_stock_item']);
    }
}
