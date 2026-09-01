<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetOwnershipType;
use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Sales\Customer;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Bug pre-existing: AssetService dan AssetServiceConsumedItem tidak punya
 * templateLink() sama sekali — ModelController::__invoke() (endpoint search
 * AssetServiceLinkModel/AssetServiceConsumedItemLinkModel di
 * SalesOrders/InternalOrders Form.jsx) 500 error setiap kali dipanggil,
 * UNCONDITIONAL, sebelum fix ini. Requirement 4.5/7.1/7.2/9.2, spec
 * asset-service-billing: butuh endpoint ini hidup utk auto-derive
 * item/customer/price saat baris referenceable dipilih.
 */
class AssetServiceLinkModelSearchTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, AssetService::class, Asset::class] as $model) {
            $model::initPermissions();
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user = User::factory()->create();
    }

    private function search(string $model, array $with = []): array {
        $response = $this
            ->actingAs($this->user)
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson('/model', ['model' => $model, 'with' => $with]);

        $response->assertOk();

        return $response->json('data');
    }

    #[Test]
    public function asset_service_search_no_longer_500s(): void {
        AssetService::factory()->create();

        $data = $this->search(AssetService::class);

        $this->assertCount(1, $data);
    }

    #[Test]
    public function asset_service_consumed_item_search_no_longer_500s(): void {
        AssetServiceConsumedItem::factory()->create();

        $data = $this->search(AssetServiceConsumedItem::class);

        $this->assertCount(1, $data);
    }

    #[Test]
    public function consumed_item_with_resolves_item_variant_for_auto_derive(): void {
        // Requirement 4.5
        $itemVariant = ItemVariant::factory()->create();
        AssetServiceConsumedItem::factory()->create(['item_id' => $itemVariant->id]);

        $data = $this->search(AssetServiceConsumedItem::class, ['item', 'item.defaultUom']);

        $this->assertSame($itemVariant->id, $data[0]['item']['id']);
        $this->assertArrayHasKey('default_uom', $data[0]['item']);
    }

    #[Test]
    public function asset_service_with_resolves_customer_when_bill_to_renter(): void {
        // Requirement 7.1
        $customer     = Customer::query()->create(['name' => 'Renter', 'is_disabled' => false]);
        $assetService = AssetService::factory()->create([
            'bill_to_renter' => true,
            'customer_id'    => $customer->id,
        ]);

        $data = $this->search(AssetService::class, ['customer', 'customerBranch']);

        $found = collect($data)->firstWhere('id', $assetService->id);
        $this->assertSame($customer->id, $found['customer']['id']);
    }

    #[Test]
    public function asset_service_with_resolves_ownership_customer_via_repair_asset(): void {
        // Requirement 7.2
        $customer = Customer::query()->create(['name' => 'Owner', 'is_disabled' => false]);
        $item     = Item::factory()->create(['is_fixed_asset' => true]);
        $category = AssetCategory::factory()->create();
        $asset    = Asset::factory()->create([
            'asset_category_id'     => $category->id,
            'item_id'               => $item->id,
            'ownership_type'        => AssetOwnershipType::CUSTOMER,
            'ownership_customer_id' => $customer->id,
            'status'                => [FormStatus::ACTIVE],
        ]);
        $assetService = AssetService::factory()->create([
            'asset_id'       => $asset->id,
            'bill_to_renter' => false,
        ]);

        $data = $this->search(AssetService::class, ['asset.ownershipCustomer', 'asset.ownershipCustomerBranch']);

        $found = collect($data)->firstWhere('id', $assetService->id);
        $this->assertSame($customer->id, $found['asset']['ownership_customer']['id']);
    }

    #[Test]
    public function consumed_item_with_resolves_asset_service_customer_for_part_row(): void {
        // Requirement 7.1, baris part
        $customer     = Customer::query()->create(['name' => 'Renter', 'is_disabled' => false]);
        $assetService = AssetService::factory()->create([
            'bill_to_renter' => true,
            'customer_id'    => $customer->id,
        ]);
        AssetServiceConsumedItem::factory()->create(['asset_service_id' => $assetService->id]);

        $data = $this->search(AssetServiceConsumedItem::class, ['assetService.customer', 'assetService.customerBranch']);

        $this->assertSame($customer->id, $data[0]['asset_service']['customer']['id']);
    }
}
