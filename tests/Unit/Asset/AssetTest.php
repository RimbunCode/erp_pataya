<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetOwnershipType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetTest extends TestCase {
    use RefreshDatabase;

    // 8.7 ── Property 1: Ownership exclusivity ──────────────────────────────

    #[Test]
    public function company_owned_asset_has_no_supplier_or_customer_fk(): void {
        $asset = Asset::factory()->companyOwned()->create([
            'ownership_company_id' => null,
        ]);

        $this->assertEquals(AssetOwnershipType::COMPANY, $asset->ownership_type);
        $this->assertNull($asset->ownership_supplier_id);
        $this->assertNull($asset->ownership_customer_id);
    }

    #[Test]
    public function supplier_owned_asset_stores_supplier_id(): void {
        $supplierId = (string) Str::ulid();

        $asset = Asset::factory()->create([
            'ownership_type'        => AssetOwnershipType::SUPPLIER,
            'ownership_supplier_id' => $supplierId,
        ]);

        $this->assertEquals(AssetOwnershipType::SUPPLIER, $asset->ownership_type);
        $this->assertEquals($supplierId, $asset->ownership_supplier_id);
        $this->assertNull($asset->ownership_customer_id);
    }

    #[Test]
    public function customer_owned_asset_stores_customer_id(): void {
        $customerId = (string) Str::ulid();

        $asset = Asset::factory()->create([
            'ownership_type'        => AssetOwnershipType::CUSTOMER,
            'ownership_customer_id' => $customerId,
        ]);

        $this->assertEquals(AssetOwnershipType::CUSTOMER, $asset->ownership_type);
        $this->assertEquals($customerId, $asset->ownership_customer_id);
        $this->assertNull($asset->ownership_supplier_id);
    }

    #[Test]
    public function ownership_entity_returns_null_for_company(): void {
        $asset = Asset::factory()->companyOwned()->create();

        $this->assertNull($asset->ownershipEntity());
    }

    // 8.8 ── Property 3: Depreciability monotonic default ───────────────────

    #[Test]
    public function non_company_ownership_sets_is_depreciable_false_by_default(): void {
        $asset = Asset::factory()->create([
            'ownership_type'        => AssetOwnershipType::SUPPLIER,
            'ownership_supplier_id' => (string) Str::ulid(),
        ]);

        $this->assertFalse($asset->is_depreciable);
    }

    #[Test]
    public function is_depreciable_can_be_overridden_explicitly(): void {
        $asset = Asset::factory()->create([
            'ownership_type'        => AssetOwnershipType::SUPPLIER,
            'ownership_supplier_id' => (string) Str::ulid(),
            'is_depreciable'        => true,
        ]);

        $this->assertTrue($asset->is_depreciable);
    }

    #[Test]
    public function company_owned_asset_is_depreciable_unchanged(): void {
        $asset = Asset::factory()->companyOwned()->create(['is_depreciable' => true]);

        $this->assertTrue($asset->is_depreciable);
    }

    #[Test]
    public function non_depreciable_category_defaults_to_false(): void {
        $category = AssetCategory::factory()->nonDepreciable()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => $category->id,
        ]);

        $this->assertFalse($asset->is_depreciable);
    }

    // 8.9 ── Property 2: Rentable quantity invariant ────────────────────────

    #[Test]
    public function rentable_category_allows_quantity_one(): void {
        $category = AssetCategory::factory()->rentable()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_quantity'    => 1,
        ]);

        $this->assertEquals(1, $asset->asset_quantity);
    }

    #[Test]
    public function rentable_category_rejects_quantity_greater_than_one(): void {
        $category = AssetCategory::factory()->rentable()->create();

        $this->expectException(LogicException::class);

        Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_quantity'    => 3,
        ]);
    }

    #[Test]
    public function non_rentable_category_allows_quantity_greater_than_one(): void {
        $category = AssetCategory::factory()->create(['is_rentable' => false]);

        $asset = Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_quantity'    => 10,
        ]);

        $this->assertEquals(10, $asset->asset_quantity);
    }

    // 8.10 ── Property 4: Status transition legality ────────────────────────

    #[Test]
    public function scrap_from_active_succeeds(): void {
        $asset = Asset::factory()->create([
            'status' => [FormStatus::ACTIVE],
        ]);

        $asset->scrap();

        $this->assertContains(FormStatus::SCRAPPED, $asset->status);
        $this->assertNotNull($asset->disposal_date);
    }

    #[Test]
    public function scrap_from_draft_throws_exception(): void {
        $asset = Asset::factory()->create([
            'status' => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);

        $asset->scrap();
    }

    #[Test]
    public function set_in_maintenance_from_active_succeeds(): void {
        $asset = Asset::factory()->create([
            'status' => [FormStatus::ACTIVE],
        ]);

        $asset->setInMaintenance();

        $this->assertContains(FormStatus::IN_MAINTENANCE, $asset->status);
        $this->assertNotContains(FormStatus::ACTIVE, $asset->status);
    }

    #[Test]
    public function reactivate_from_out_of_order_succeeds(): void {
        $asset = Asset::factory()->create([
            'status' => [FormStatus::OUT_OF_ORDER],
        ]);

        $asset->reactivate();

        $this->assertContains(FormStatus::ACTIVE, $asset->status);
        $this->assertNotContains(FormStatus::OUT_OF_ORDER, $asset->status);
    }

    #[Test]
    public function sell_throws_not_implemented(): void {
        $asset = Asset::factory()->create([
            'status' => [FormStatus::ACTIVE],
        ]);

        $this->expectException(LogicException::class);

        $asset->sell();
    }

    // 8.11 ── total_asset_cost accessor ─────────────────────────────────────

    #[Test]
    public function total_asset_cost_is_sum_of_gross_and_additional(): void {
        $asset = Asset::factory()->create([
            'gross_purchase_amount' => 100000,
            'additional_asset_cost' => 5000,
        ]);

        $this->assertEquals(105000, $asset->total_asset_cost);
    }

    #[Test]
    public function total_asset_cost_defaults_additional_to_zero(): void {
        $asset = Asset::factory()->create([
            'gross_purchase_amount' => 100000,
        ]);

        $this->assertEquals(100000, $asset->total_asset_cost);
    }

    // Standard model properties/methods (formComponent, translateKey,
    // templateLink, configColumns) — dilewatkan pada implementasi awal,
    // ditambahkan setelah audit. Dipakai renderShow()/LinkModel/DataTable
    // generik di seluruh codebase, WAJIB ada di setiap model DataTable.

    #[Test]
    public function has_form_component_property(): void {
        $asset = new Asset;

        $this->assertSame('Asset/Assets/Form', $asset->formComponent);
    }

    #[Test]
    public function has_translate_key_property(): void {
        $asset = new Asset;

        $this->assertSame('asset.asset', $asset->translateKey);
    }

    #[Test]
    public function template_link_method_exists_and_returns_string(): void {
        $this->assertTrue(method_exists(Asset::class, 'templateLink'));
        $this->assertIsString(Asset::templateLink());
    }

    #[Test]
    public function custodian_relation_resolves_to_user(): void {
        $asset = new Asset;

        $this->assertInstanceOf(BelongsTo::class, $asset->custodian());
        $this->assertInstanceOf(User::class, $asset->custodian()->getRelated());
    }

    #[Test]
    public function branch_accessor_resolves_via_asset_location(): void {
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create(['asset_location_id' => $location->id]);

        $this->assertNotNull($asset->branch());
        $this->assertEquals($location->branch_id, $asset->branch()->id);
    }
}
