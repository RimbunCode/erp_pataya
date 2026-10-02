<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetOwnershipType;
use App\Models\Asset\Asset;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Preference;
use App\Models\Model as BaseModel;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Services\Core\DataTable\Group\GroupColumnGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Grup `ownership` Asset (spec asset-ownership-morph Requirement 7-8): gerbang
 * `groupMorph`, label nama pemilik (tersaring kolom aman), grup company
 * berlabel Preference `company_name` dan tampil PERTAMA.
 */
class AssetOwnershipGroupTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Asset::class, Supplier::class, Customer::class] as $model) {
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

    /** @return array{0: Supplier, 1: Customer} */
    private function seedAssets(): array {
        // withoutEvents: hook audit memanggil toArray() dan Supplier::getAddressAttribute()
        // crash bila country null (bug lama, lihat CreateAssetFromPurchaseListenerTest).
        [$supplier, $customer] = BaseModel::withoutEvents(fn () => [
            Supplier::query()->create(['name' => 'Pemasok Z', 'phone' => '0811-RAHASIA-S', 'is_disabled' => false]),
            Customer::query()->create(['name' => 'Pelanggan A', 'phone' => '0812-RAHASIA-C', 'is_disabled' => false]),
        ]);

        Asset::factory()->create(['ownership_type' => AssetOwnershipType::SUPPLIER, 'ownership_id' => $supplier->id]);
        Asset::factory()->create(['ownership_type' => AssetOwnershipType::CUSTOMER, 'ownership_id' => $customer->id]);
        Asset::factory()->create(['ownership_type' => AssetOwnershipType::CUSTOMER, 'ownership_id' => $customer->id]);
        Asset::factory()->count(2)->create(['ownership_type' => AssetOwnershipType::COMPANY]);
        Preference::query()->updateOrCreate(['key' => 'company_name'], ['value' => 'PT Contoh Sejahtera']);

        return [$supplier, $customer];
    }

    private function lookup(array $body) {
        return $this->actingAs($this->user)
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson('/model', ['model' => Asset::class, ...$body]);
    }

    #[Test]
    public function gate_accepts_flagged_morph_and_uses_id_column(): void {
        $columns = Asset::getColumns(1);
        $gate    = GroupColumnGate::gate('ownership', GroupColumnGate::sanitizeColumns($columns, new Asset), new Asset);

        $this->assertTrue($gate['isGroupable']);
        $this->assertSame('ownership_id', $gate['sqlColumn']);
    }

    #[Test]
    public function gate_rejects_morph_without_group_morph_flag(): void {
        $model   = new ApprovalInstance;
        $columns = [[
            'name'           => 'document',
            'type'           => 'relation',
            'nameOfFunction' => 'document',
            'groupable'      => true,
        ]];

        $this->assertNull(GroupColumnGate::relationSqlColumn($model, $columns[0]));
        $this->assertFalse(GroupColumnGate::gate('document', GroupColumnGate::sanitizeColumns($columns, $model), $model)['isGroupable']);
    }

    #[Test]
    public function level_zero_lists_company_first_then_owners_with_names_and_counts(): void {
        $this->seedAssets();

        $res = $this->lookup(['groupTree' => true, 'group' => ['ownership'], 'fields' => ['ownership']]);

        $res->assertOk();
        $this->assertSame('groups', $res->json('type'));
        $this->assertSame('ownership', $res->json('groupMeta.levels.0.column'));

        $groups = collect($res->json('data'));
        // Grup company (ownership_id NULL) PERTAMA, label = Preference company_name.
        $this->assertSame('null', $groups[0]['key']);
        $this->assertSame(2, $groups[0]['count']);
        $this->assertSame('PT Contoh Sejahtera', $groups[0]['label']['name']);

        $byName = $groups->skip(1)->mapWithKeys(fn ($g) => [$g['label']['name'] => $g['count']])->all();
        // urutan antar-pemilik tak dijamin (key ULID); yang dijamin hanya NULL di depan.
        $this->assertEquals(['Pelanggan A' => 2, 'Pemasok Z' => 1], $byName);
    }

    #[Test]
    public function prefill_attaches_first_page_rows_to_auto_expanded_groups_only(): void {
        $this->seedAssets();

        // anggaran 2: grup company (2 baris) muat; grup berikutnya melebihi sisa.
        $res = $this->lookup(['groupTree' => true, 'group' => ['ownership'], 'fields' => ['ownership'], 'prefill' => 2]);

        $res->assertOk();
        $groups = collect($res->json('data'));
        $this->assertSame('null', $groups[0]['key']);
        $this->assertSame('rows', $groups[0]['children']['type']);
        $this->assertCount(2, $groups[0]['children']['data']);
        $this->assertArrayNotHasKey('children', $groups[1]);
    }

    #[Test]
    public function prefill_nests_sub_groups_and_ignores_expand_requests_and_absent_param(): void {
        $this->seedAssets();

        // anggaran 2 -> hanya grup company (tanpa baris Supplier: accessor alamat
        // Supplier crash bila country null, bug lama).
        $nested = $this->lookup(['groupTree' => true, 'group' => ['ownership', 'asset_type'], 'prefill' => 2]);
        $nested->assertOk();
        $first = $nested->json('data.0');
        $this->assertSame('groups', $first['children']['type']);
        $this->assertSame('rows', $first['children']['data'][0]['children']['type']);

        $plain = $this->lookup(['groupTree' => true, 'group' => ['ownership']]);
        $this->assertArrayNotHasKey('children', $plain->json('data.0'));

        $expand = $this->lookup(['group' => ['ownership', 'asset_type'], 'groupPath' => json_encode([null]), 'prefill' => 25]);
        $expand->assertOk();
        $this->assertArrayNotHasKey('children', $expand->json('data.0'));
    }

    #[Test]
    public function owner_labels_never_leak_non_template_columns(): void {
        $this->seedAssets();

        $res = $this->lookup(['groupTree' => true, 'group' => ['ownership'], 'fields' => ['ownership']]);

        $res->assertOk();
        $this->assertStringNotContainsString('RAHASIA', $res->getContent());
        foreach (collect($res->json('data'))->skip(1) as $group) {
            $this->assertArrayHasKey('name', $group['label']);
            $this->assertArrayNotHasKey('phone', $group['label']);
        }
    }

    #[Test]
    public function expanding_an_owner_group_returns_only_its_assets(): void {
        [, $customer] = $this->seedAssets();

        $res = $this->lookup([
            'group'     => ['ownership'],
            'groupPath' => json_encode([$customer->id]),
            'fields'    => ['ownership'],
        ]);

        $res->assertOk();
        $this->assertSame('rows', $res->json('type'));
        $this->assertSame(2, $res->json('total'));
    }

    #[Test]
    public function company_group_without_preference_has_no_label(): void {
        $this->seedAssets();
        Preference::query()->where('key', 'company_name')->delete();

        $res = $this->lookup(['groupTree' => true, 'group' => ['ownership'], 'fields' => ['ownership']]);

        $res->assertOk();
        $company = collect($res->json('data'))->firstWhere('key', 'null');
        $this->assertNull($company['label']);
    }
}
