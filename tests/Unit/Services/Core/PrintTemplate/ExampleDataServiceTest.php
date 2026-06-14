<?php

namespace Tests\Unit\Services\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\ExampleDataService;
use App\Traits\HasExampleData;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ExampleDataServiceTest extends TestCase {
    use LazilyRefreshDatabase;

    protected ExampleDataService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new ExampleDataService;
        Cache::flush();

        // Create test tables
        $this->createTestTables();
    }

    protected function createTestTables(): void {
        Schema::dropIfExists('test_example_grandchildren');
        Schema::dropIfExists('test_example_children');
        Schema::dropIfExists('test_example_parents');
        Schema::dropIfExists('test_example_models');

        Schema::create('test_example_models', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->boolean('is_example')->default(false);
        });

        Schema::create('test_example_parents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->boolean('is_example')->default(false);
        });

        Schema::create('test_example_children', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('parent_id')->nullable()->constrained('test_example_parents')->nullOnDelete();
            $table->string('name');
        });

        Schema::create('test_example_grandchildren', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('child_id')->nullable()->constrained('test_example_children')->nullOnDelete();
            $table->string('name');
        });
    }

    /**
     * Test getExampleData returns first example record
     *
     * **Validates: Requirements 8.4**
     */
    public function test_get_example_data_returns_first_example_record(): void {
        // Create test model with example data
        $model = TestExampleModel::create([
            'name'       => 'Example 1',
            'is_example' => true,
        ]);

        $result = $this->service->getExampleData(TestExampleModel::class);

        $this->assertNotNull($result);
        $this->assertEquals($model->id, $result->id);
        $this->assertTrue($result->is_example);
    }

    /**
     * Test getExampleData returns null when no example data exists
     *
     * **Validates: Requirements 8.4**
     */
    public function test_get_example_data_returns_null_when_no_example_exists(): void {
        // Create non-example data
        TestExampleModel::create([
            'name'       => 'Regular Data',
            'is_example' => false,
        ]);

        $result = $this->service->getExampleData(TestExampleModel::class);

        $this->assertNull($result);
    }

    /**
     * Test getExampleData returns null for non-existent model class
     *
     * **Validates: Requirements 8.4**
     */
    public function test_get_example_data_returns_null_for_invalid_model_class(): void {
        $result = $this->service->getExampleData('App\\Models\\NonExistentModel');

        $this->assertNull($result);
    }

    /**
     * Test getExampleData caches results
     *
     * **Validates: Requirements 8.4**
     */
    public function test_get_example_data_caches_results(): void {
        TestExampleModel::create([
            'name'       => 'Example 1',
            'is_example' => true,
        ]);

        // First call - should query database
        $result1 = $this->service->getExampleData(TestExampleModel::class);

        // Second call - should use cache
        $result2 = $this->service->getExampleData(TestExampleModel::class);

        $this->assertEquals($result1->id, $result2->id);

        // Verify cache was used
        $cacheKey = 'example_data.' . TestExampleModel::class;
        $this->assertTrue(Cache::has($cacheKey));
    }

    /**
     * Test getExampleDataWithRelations loads specified relations
     *
     * **Validates: Requirements 8.5, 11.9**
     */
    public function test_get_example_data_with_relations_loads_relations(): void {
        // Create parent with relation
        $parent = TestExampleParent::create([
            'name'       => 'Parent Example',
            'is_example' => true,
        ]);

        $child = TestExampleChild::create([
            'parent_id' => $parent->id,
            'name'      => 'Child 1',
        ]);

        $result = $this->service->getExampleDataWithRelations(
            TestExampleParent::class,
            ['children'],
        );

        $this->assertNotNull($result);
        $this->assertTrue($result->relationLoaded('children'));
        $this->assertCount(1, $result->children);
    }

    /**
     * Test getExampleDataWithRelations validates relations before loading
     *
     * **Validates: Requirements 8.6**
     */
    public function test_get_example_data_with_relations_validates_relations(): void {
        TestExampleParent::create([
            'name'       => 'Parent Example',
            'is_example' => true,
        ]);

        // Try to load non-existent relation
        $result = $this->service->getExampleDataWithRelations(
            TestExampleParent::class,
            ['nonExistentRelation'],
        );

        $this->assertNotNull($result);
        $this->assertFalse($result->relationLoaded('nonExistentRelation'));
    }

    /**
     * Test getExampleDataWithRelations handles nested relations
     *
     * **Validates: Requirements 8.5**
     */
    public function test_get_example_data_with_relations_handles_nested_relations(): void {
        // Create parent with nested relations
        $parent = TestExampleParent::create([
            'name'       => 'Parent Example',
            'is_example' => true,
        ]);

        $child = TestExampleChild::create([
            'parent_id' => $parent->id,
            'name'      => 'Child 1',
        ]);

        $grandchild = TestExampleGrandchild::create([
            'child_id' => $child->id,
            'name'     => 'Grandchild 1',
        ]);

        $result = $this->service->getExampleDataWithRelations(
            TestExampleParent::class,
            ['children', 'children.grandchildren'],
        );

        $this->assertNotNull($result);
        $this->assertTrue($result->relationLoaded('children'));
        $this->assertTrue($result->children->first()->relationLoaded('grandchildren'));
    }

    /**
     * Test getExampleDataForTemplate uses template's used_relations
     *
     * **Validates: Requirements 9.3**
     */
    public function test_get_example_data_for_template_uses_template_relations(): void {
        // Create example data
        $parent = TestExampleParent::create([
            'name'       => 'Parent Example',
            'is_example' => true,
        ]);

        TestExampleChild::create([
            'parent_id' => $parent->id,
            'name'      => 'Child 1',
        ]);

        // Create template with used_relations
        $template = PrintTemplate::create([
            'name'           => 'Test Template',
            'model'          => TestExampleParent::class,
            'used_relations' => ['children'],
        ]);

        $result = $this->service->getExampleDataForTemplate($template);

        $this->assertNotNull($result);
        $this->assertTrue($result->relationLoaded('children'));
    }

    /**
     * Test getExampleDataForTemplate returns null when model is null
     *
     * **Validates: Requirements 9.3**
     */
    public function test_get_example_data_for_template_returns_null_when_model_is_null(): void {
        $template = PrintTemplate::create([
            'name'  => 'Test Template',
            'model' => null,
        ]);

        $result = $this->service->getExampleDataForTemplate($template);

        $this->assertNull($result);
    }

    /**
     * Test hasExampleData returns true when example data exists
     *
     * **Validates: Requirements 8.4**
     */
    public function test_has_example_data_returns_true_when_exists(): void {
        TestExampleModel::create([
            'name'       => 'Example 1',
            'is_example' => true,
        ]);

        $result = $this->service->hasExampleData(TestExampleModel::class);

        $this->assertTrue($result);
    }

    /**
     * Test hasExampleData returns false when no example data exists
     *
     * **Validates: Requirements 8.4**
     */
    public function test_has_example_data_returns_false_when_not_exists(): void {
        TestExampleModel::create([
            'name'       => 'Regular Data',
            'is_example' => false,
        ]);

        $result = $this->service->hasExampleData(TestExampleModel::class);

        $this->assertFalse($result);
    }

    /**
     * Test hasExampleData returns false for invalid model class
     *
     * **Validates: Requirements 8.4**
     */
    public function test_has_example_data_returns_false_for_invalid_model(): void {
        $result = $this->service->hasExampleData('App\\Models\\NonExistentModel');

        $this->assertFalse($result);
    }

    /**
     * Test hasExampleData caches results
     *
     * **Validates: Requirements 8.4**
     */
    public function test_has_example_data_caches_results(): void {
        TestExampleModel::create([
            'name'       => 'Example 1',
            'is_example' => true,
        ]);

        // First call
        $result1 = $this->service->hasExampleData(TestExampleModel::class);

        // Second call - should use cache
        $result2 = $this->service->hasExampleData(TestExampleModel::class);

        $this->assertTrue($result1);
        $this->assertTrue($result2);

        // Verify cache was used
        $cacheKey = 'example_data_exists.' . TestExampleModel::class;
        $this->assertTrue(Cache::has($cacheKey));
    }

    /**
     * Test getExampleDataWithRelations returns basic data when no valid relations
     *
     * **Validates: Requirements 8.6**
     */
    public function test_get_example_data_with_relations_falls_back_to_basic_when_no_valid_relations(): void {
        TestExampleModel::create([
            'name'       => 'Example 1',
            'is_example' => true,
        ]);

        $result = $this->service->getExampleDataWithRelations(
            TestExampleModel::class,
            ['nonExistentRelation'],
        );

        $this->assertNotNull($result);
    }

    /**
     * Test getExampleDataWithRelations caches results with relation key
     *
     * **Validates: Requirements 8.5**
     */
    public function test_get_example_data_with_relations_caches_with_relation_key(): void {
        $parent = TestExampleParent::create([
            'name'       => 'Parent Example',
            'is_example' => true,
        ]);

        TestExampleChild::create([
            'parent_id' => $parent->id,
            'name'      => 'Child 1',
        ]);

        // First call
        $result1 = $this->service->getExampleDataWithRelations(
            TestExampleParent::class,
            ['children'],
        );

        // Second call - should use cache
        $result2 = $this->service->getExampleDataWithRelations(
            TestExampleParent::class,
            ['children'],
        );

        $this->assertEquals($result1->id, $result2->id);
    }
}

/**
 * Test model for ExampleDataService tests
 */
class TestExampleModel extends Model {
    use HasExampleData, HasUlids;

    protected $table    = 'test_example_models';
    protected $guarded  = [];
    protected $fillable = ['name', 'is_example'];
    protected $casts    = [
        'is_example' => 'boolean',
    ];
    public $timestamps = false;
}

/**
 * Test parent model with relations
 */
class TestExampleParent extends Model {
    use HasExampleData, HasUlids;

    protected $table    = 'test_example_parents';
    protected $guarded  = [];
    protected $fillable = ['name', 'is_example'];
    protected $casts    = [
        'is_example' => 'boolean',
    ];
    public $timestamps = false;

    public function children(): HasMany {
        return $this->hasMany(TestExampleChild::class, 'parent_id');
    }
}

/**
 * Test child model
 */
class TestExampleChild extends Model {
    use HasUlids;

    protected $table    = 'test_example_children';
    protected $guarded  = [];
    protected $fillable = ['parent_id', 'name'];
    public $timestamps  = false;

    public function parent(): BelongsTo {
        return $this->belongsTo(TestExampleParent::class, 'parent_id');
    }

    public function grandchildren(): HasMany {
        return $this->hasMany(TestExampleGrandchild::class, 'child_id');
    }
}

/**
 * Test grandchild model for nested relations
 */
class TestExampleGrandchild extends Model {
    use HasUlids;

    protected $table    = 'test_example_grandchildren';
    protected $guarded  = [];
    protected $fillable = ['child_id', 'name'];
    public $timestamps  = false;

    public function child(): BelongsTo {
        return $this->belongsTo(TestExampleChild::class, 'child_id');
    }
}
