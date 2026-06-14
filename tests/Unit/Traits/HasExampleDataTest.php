<?php

namespace Tests\Unit\Traits;

use App\Traits\HasExampleData;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;

class HasExampleDataTest extends TestCase {
    /**
     * Test scopeExampleData method exists
     */
    public function test_scope_example_data_method_exists(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $table   = 'test_table';
            protected $guarded = [];
        };

        $this->assertTrue(method_exists($model, 'scopeExampleData'));
    }

    /**
     * Test isExampleData returns true for example data
     */
    public function test_is_example_data_returns_true_for_example_data(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $guarded = [];
        };

        $model->is_example = true;

        $this->assertTrue($model->isExampleData());
    }

    /**
     * Test isExampleData returns false for non-example data
     */
    public function test_is_example_data_returns_false_for_non_example_data(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $guarded = [];
        };

        $model->is_example = false;

        $this->assertFalse($model->isExampleData());
    }

    /**
     * Test isExampleData returns false when is_example is null
     */
    public function test_is_example_data_returns_false_when_null(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $guarded = [];
        };

        $model->is_example = null;

        $this->assertFalse($model->isExampleData());
    }

    /**
     * Test isExampleData returns false when is_example is 0
     */
    public function test_is_example_data_returns_false_when_zero(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $guarded = [];
        };

        $model->is_example = 0;

        $this->assertFalse($model->isExampleData());
    }

    /**
     * Test isExampleData uses strict comparison
     */
    public function test_is_example_data_uses_strict_comparison(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $guarded = [];
        };

        // Test with integer 1 (should be false with strict comparison)
        $model->is_example = 1;
        $this->assertFalse($model->isExampleData());

        // Test with boolean true (should be true)
        $model->is_example = true;
        $this->assertTrue($model->isExampleData());
    }

    /**
     * Test markAsExample method exists
     */
    public function test_mark_as_example_method_exists(): void {
        $model = new class extends Model
        {
            use HasExampleData;

            protected $table   = 'test_table';
            protected $guarded = [];
        };

        $this->assertTrue(method_exists($model, 'markAsExample'));
    }
}
