<?php

namespace Tests\Feature\Rules;

use App\Models\Inventory\Category;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ExistsExcludingTrashedTest extends TestCase {
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

    private function validate(mixed $value): bool {
        $validator = Validator::make(
            ['category_id' => $value],
            ['category_id' => [new ExistsExcludingTrashed('categories', 'id')]],
        );

        return $validator->passes();
    }

    public function test_passes_for_active_record(): void {
        $category = Category::create(['name' => 'Active Category', 'type' => 'inventory']);

        $this->assertTrue($this->validate($category->id));
    }

    public function test_fails_for_soft_deleted_record(): void {
        $category = Category::create(['name' => 'Deleted Category', 'type' => 'inventory']);
        $category->delete();

        $this->assertFalse($this->validate($category->id));
    }

    public function test_fails_for_nonexistent_record(): void {
        $this->assertFalse($this->validate('non-existent-id'));
    }
}
