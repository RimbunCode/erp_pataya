<?php

namespace Tests\Feature\Traits;

use App\Models\Inventory\Category;
use App\Models\Inventory\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DataTableLoadRelationsSoftDeleteTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_load_relations_default_excludes_trashed_relation(): void {
        // Property 2 (kondisi kontras): default loadRelations() TANPA withTrashed
        // tetap perilaku lama — relasi soft-deleted jadi null. Regresi terhadap
        // pemanggilan loadRelations() existing di luar Show yang tidak diubah.
        $unit     = Unit::create(['name' => 'Kilogram', 'code' => 'kg']);
        $category = Category::create(['name' => 'Test Category', 'type' => 'inventory', 'default_unit_id' => $unit->id]);
        $unit->delete();

        $category->loadRelations();

        $this->assertNull($category->defaultUnit);
    }

    public function test_load_relations_with_trashed_keeps_soft_deleted_relation(): void {
        // Property 2: Show/Edit dengan withTrashed: true tetap memuat relasi yang
        // sudah soft-deleted, deleted_at ikut terserialize sebagai sinyal.
        $unit     = Unit::create(['name' => 'Liter', 'code' => 'L']);
        $category = Category::create(['name' => 'Test Category 2', 'type' => 'inventory', 'default_unit_id' => $unit->id]);
        $unit->delete();

        $category->loadRelations([], withTrashed: true);

        $this->assertNotNull($category->defaultUnit, 'Relasi tidak boleh null walau sudah di-soft-delete.');
        $this->assertNotNull($category->defaultUnit->deleted_at);
    }

    public function test_load_relations_with_trashed_still_works_for_non_deleted_relation(): void {
        // Regresi: withTrashed: true tidak boleh mengubah hasil untuk relasi yang
        // masih aktif (belum di-soft-delete).
        $unit     = Unit::create(['name' => 'Meter', 'code' => 'm']);
        $category = Category::create(['name' => 'Test Category 3', 'type' => 'inventory', 'default_unit_id' => $unit->id]);

        $category->loadRelations([], withTrashed: true);

        $this->assertNotNull($category->defaultUnit);
        $this->assertNull($category->defaultUnit->deleted_at);
    }
}
