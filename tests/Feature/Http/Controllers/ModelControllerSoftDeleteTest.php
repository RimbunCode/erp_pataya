<?php

namespace Tests\Feature\Http\Controllers;

use App\Models\Inventory\Category;
use App\Models\User\Assignable;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModelControllerSoftDeleteTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();
        $this->withoutExceptionHandling();

        // is_example ditambahkan via seeder/initPermissions di prod, bukan migration.
        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function createCategory(string $name): Category {
        return Category::create(['name' => $name, 'type' => 'inventory']);
    }

    public function test_deleted_at_not_stripped_from_lookup_by_id_response(): void {
        $category = $this->createCategory('Test Category Lookup');
        $category->delete();

        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model' => Category::class,
                'id'    => $category->id,
            ]);

        $response->assertOk();
        $this->assertNotNull($response->json('deleted_at'));
    }

    public function test_soft_deleted_category_excluded_from_dropdown_search(): void {
        // Dropdown search (bukan lookup by-id) TIDAK boleh menawarkan opsi yang sudah
        // di-soft-delete sebagai pilihan baru — hanya lookup-by-id (histori tersimpan)
        // yang harus withTrashed. Regresi terhadap fix Task 1 (find() -> withTrashed()).
        $category = $this->createCategory('Test Category Search');
        $category->delete();

        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model'  => Category::class,
                'search' => $category->name,
            ]);

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $category->id);
        $this->assertNull($row, 'Soft-deleted category tidak boleh muncul sbg opsi dropdown baru.');
    }

    public function test_assignable_deleted_at_resolves_for_soft_deleted_user(): void {
        $user = User::factory()->create();
        $user->delete();

        $response = $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model' => Assignable::class,
                'id'    => $user->id,
            ]);

        $response->assertOk();
        $this->assertNotNull($response->json('deleted_at'), 'Assignable::deleted_at harus resolve utk histori assignee yang sudah dihapus.');
        $this->assertNotNull($response->json('name'), 'Nama assignee tetap harus tampil walau sudah di-soft-delete.');
    }

    public function test_assignable_soft_deleted_still_excluded_from_dropdown_search(): void {
        // scopeLinkModel() tetap harus menyaring row soft-deleted dari OPSI dropdown baru —
        // beda dari lookup-by-id di atas. Regresi terhadap perubahan Task 1.2.
        $user = User::factory()->create(['name' => 'Regresi Dropdown Assignable']);
        $user->delete();

        $results = Assignable::linkModel('Regresi Dropdown Assignable')->get();

        $this->assertFalse($results->contains('id', $user->id));
    }
}
