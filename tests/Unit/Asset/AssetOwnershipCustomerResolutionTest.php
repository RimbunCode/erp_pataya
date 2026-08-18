<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetOwnershipType;
use App\Models\Asset\Asset;
use App\Models\Core\Branch;
use App\Models\Sales\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetOwnershipCustomerResolutionTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function ownership_customer_branch_resolves_when_asset_owned_by_customer(): void {
        $customer = Customer::query()->create(['name' => 'Owner', 'is_disabled' => false]);
        $branch   = Branch::create(['name' => 'Owner Branch', 'is_main_branch' => false]);

        $asset = Asset::factory()->create([
            'ownership_type'               => AssetOwnershipType::CUSTOMER,
            'ownership_customer_id'        => $customer->id,
            'ownership_customer_branch_id' => $branch->id,
        ]);

        $this->assertTrue($asset->ownershipCustomer->is($customer));
        $this->assertTrue($asset->ownershipCustomerBranch->is($branch));
    }

    #[Test]
    public function ownership_customer_branch_is_null_when_asset_owned_by_company(): void {
        $asset = Asset::factory()->create(['ownership_type' => AssetOwnershipType::COMPANY]);

        $this->assertNull($asset->ownershipCustomer);
        $this->assertNull($asset->ownershipCustomerBranch);
    }
}
