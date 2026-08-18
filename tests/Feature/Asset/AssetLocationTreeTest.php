<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\AssetLocation;
use App\Models\Core\Branch;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetLocationTreeTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function create_root_node_sets_lft_rgt_depth(): void {
        $location = AssetLocation::factory()->create();

        $this->assertDatabaseHas('asset_locations', [
            'id'    => $location->id,
            'lft'   => 1,
            'rgt'   => 2,
            'depth' => 0,
        ]);
    }

    #[Test]
    public function create_child_node_updates_parent_boundaries(): void {
        $parent = AssetLocation::factory()->create();
        $child  = AssetLocation::factory()->withParent($parent)->create();

        // ponytail: refresh parent — TreeView DB increment bypasses in-memory model
        $parent->refresh();

        // Child should be inside parent's range
        $this->assertGreaterThan($parent->lft, $child->lft);
        $this->assertLessThan($parent->rgt, $child->rgt);
        $this->assertEquals($parent->depth + 1, $child->depth);
    }

    #[Test]
    public function create_second_root_increments_boundaries(): void {
        $first  = AssetLocation::factory()->create();
        $second = AssetLocation::factory()->create();

        // Two roots: first [1,2], second [3,4]
        $this->assertEquals(1, $first->lft);
        $this->assertEquals(2, $first->rgt);
        $this->assertEquals(3, $second->lft);
        $this->assertEquals(4, $second->rgt);
    }

    #[Test]
    public function parent_relation_works(): void {
        $parent = AssetLocation::factory()->create();
        $child  = AssetLocation::factory()->withParent($parent)->create();

        $this->assertTrue($child->parent()->is($parent));
    }

    /**
     * BUG DITEMUKAN+DIPERBAIKI (audit standard model properties): AssetLocation
     * pakai trait HasBranch tapi TIDAK punya relasi branch() sendiri — HasBranch
     * cuma sediakan query scope (bootHasBranch), bukan relasi Eloquent. Tanpa
     * relasi ini, $location->branch selalu Call-to-undefined-relationship, dan
     * Asset::branch() accessor (yang delegasi ke assetLocation->branch) selalu
     * gagal diam-diam. Konsisten pola Warehouse::branch() yang juga pakai HasBranch.
     */
    #[Test]
    public function branch_relation_resolves_to_branch_model(): void {
        $location = AssetLocation::factory()->create();

        $this->assertInstanceOf(BelongsTo::class, $location->branch());
        $this->assertInstanceOf(Branch::class, $location->branch);
        $this->assertEquals($location->branch_id, $location->branch->id);
    }

    #[Test]
    public function has_form_component_property(): void {
        $location = new AssetLocation;

        $this->assertSame('Asset/Locations/Form', $location->formComponent);
    }

    #[Test]
    public function has_translate_key_property(): void {
        $location = new AssetLocation;

        $this->assertSame('asset.location', $location->translateKey);
    }

    #[Test]
    public function template_link_method_exists_and_returns_string(): void {
        $this->assertTrue(method_exists(AssetLocation::class, 'templateLink'));
        $this->assertIsString(AssetLocation::templateLink());
    }
}
