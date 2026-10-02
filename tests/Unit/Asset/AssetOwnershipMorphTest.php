<?php

namespace Tests\Unit\Asset;

use App\Enums\AssetOwnershipType;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetOwnershipMorphTo;
use App\Models\Core\Branch;
use App\Models\Core\Preference;
use App\Models\Model as BaseModel;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Relasi morph `Asset::ownership()` (spec asset-ownership-morph Requirement 2-3):
 * supplier/customer ter-resolve, company -> null tanpa error/query, tanpa
 * morphMap global.
 */
class AssetOwnershipMorphTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        // Kolom runtime (lft/rgt/depth, dst) diprovision initPermissions() --
        // tanpa ini create() Supplier/Customer gagal "no column named lft".
        foreach ([Supplier::class, Customer::class, Asset::class] as $model) {
            $model::initPermissions();
        }
    }

    private function mixedAssets(): array {
        // withoutEvents: hook audit DataTable::created memanggil toArray() dan
        // Supplier::getAddressAttribute() crash bila country null (bug lama,
        // lihat CreateAssetFromPurchaseListenerTest) -- tak relevan utk tes ini.
        [$supplier, $customer] = BaseModel::withoutEvents(fn () => [
            Supplier::query()->create(['name' => 'Pemasok A', 'is_disabled' => false]),
            Customer::query()->create(['name' => 'Pelanggan B', 'is_disabled' => false]),
        ]);

        return [
            $supplier,
            $customer,
            Asset::factory()->create(['ownership_type' => AssetOwnershipType::SUPPLIER, 'ownership_id' => $supplier->id]),
            Asset::factory()->create(['ownership_type' => AssetOwnershipType::CUSTOMER, 'ownership_id' => $customer->id]),
            Asset::factory()->create(['ownership_type' => AssetOwnershipType::COMPANY]),
        ];
    }

    #[Test]
    public function ownership_resolves_supplier_customer_and_null_for_company_lazy(): void {
        [$supplier, $customer, $a, $b, $c] = $this->mixedAssets();

        $this->assertTrue(Asset::find($a->id)->ownership->is($supplier));
        $this->assertTrue(Asset::find($b->id)->ownership->is($customer));
        $this->assertNull(Asset::find($c->id)->ownership);
    }

    #[Test]
    public function eager_loading_mixed_types_resolves_each_and_company_gets_null_without_extra_queries(): void {
        [$supplier, $customer, $a, $b, $c] = $this->mixedAssets();

        $assets = Asset::with('ownership')->whereIn('id', [$a->id, $b->id, $c->id])->get()->keyBy('id');

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->assertTrue($assets[$a->id]->ownership->is($supplier));
        $this->assertTrue($assets[$b->id]->ownership->is($customer));
        $this->assertNull($assets[$c->id]->ownership);
        $this->assertTrue($assets[$c->id]->relationLoaded('ownership'));
        $this->assertSame([], DB::getQueryLog(), 'akses relasi setelah eager-load tak boleh query lagi');
    }

    #[Test]
    public function relation_is_the_asset_specific_morph_class(): void {
        $this->assertInstanceOf(AssetOwnershipMorphTo::class, Asset::factory()->make()->ownership());
    }

    #[Test]
    public function no_global_morph_map_is_registered_and_other_morphs_are_unchanged(): void {
        $this->mixedAssets();

        $this->assertNull(Relation::getMorphedModel('customer'));
        $this->assertNull(Relation::getMorphedModel('supplier'));
        $this->assertSame(Customer::class, (new Customer)->getMorphClass());
        $this->assertSame(Supplier::class, (new Supplier)->getMorphClass());
    }

    #[Test]
    public function ownership_name_uses_owner_name_or_company_preference(): void {
        [, , $a, $b, $c] = $this->mixedAssets();
        Preference::query()->updateOrCreate(['key' => 'company_name'], ['value' => 'PT Contoh']);

        $this->assertSame('Pemasok A', Asset::find($a->id)->ownership_name);
        $this->assertSame('Pelanggan B', Asset::find($b->id)->ownership_name);
        $this->assertSame('PT Contoh', Asset::find($c->id)->ownership_name);
    }

    #[Test]
    public function customer_branch_is_cleared_when_type_changes_away_from_customer(): void {
        $customer = Customer::query()->create(['name' => 'Pelanggan', 'is_disabled' => false]);
        $branch   = Branch::create(['name' => 'Cabang', 'is_main_branch' => false]);
        $asset    = Asset::factory()->create([
            'ownership_type'               => AssetOwnershipType::CUSTOMER,
            'ownership_id'                 => $customer->id,
            'ownership_customer_branch_id' => $branch->id,
        ]);

        // Tetap customer: cabang dipertahankan.
        $asset->update(['asset_name' => 'Ganti nama']);
        $this->assertSame($branch->id, $asset->fresh()->ownership_customer_branch_id);

        $asset->update(['ownership_type' => AssetOwnershipType::COMPANY, 'ownership_id' => null]);
        $this->assertNull($asset->fresh()->ownership_customer_branch_id);
    }
}
