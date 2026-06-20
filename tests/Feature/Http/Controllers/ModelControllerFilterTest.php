<?php

namespace Tests\Feature\Http\Controllers;

use App\Models\Model as AppModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FilterEndpointTestCategory extends AppModel {
    use HasUlids;

    protected $table   = 'filter_endpoint_categories';
    protected $guarded = ['id'];
    public $timestamps = true;
}

class FilterEndpointTestRecord extends AppModel {
    use HasUlids;

    protected $table   = 'filter_endpoint_records';
    protected $guarded = ['id'];
    public $timestamps = true;

    protected function casts(): array {
        return [
            'is_active'  => 'boolean',
            'qty'        => 'integer',
            'started_at' => 'datetime',
            'born_on'    => 'date',
        ];
    }

    public function category(): BelongsTo {
        return $this->belongsTo(FilterEndpointTestCategory::class, 'category_id');
    }

    // Dibutuhkan oleh ModelController
    public static function getTableName() {
        return 'filter_endpoint_records';
    }

    public function getNameClass() {
        return 'FilterEndpointTestRecord';
    }

    public static function templateLink() {
        return ':name';
    }

    // Stub getColumns untuk Test
    public static function getColumns(int $maxDepth = 0, ...$excepts) {
        return [
            'name'      => ['name' => 'name', 'type' => 'string', 'searchable' => true],
            'qty'       => ['name' => 'qty', 'type' => 'number', 'searchable' => true],
            'is_active' => ['name' => 'is_active', 'type' => 'boolean', 'searchable' => true],
            'born_on'   => ['name' => 'born_on', 'type' => 'date', 'searchable' => true],
            'category'  => [
                'name'           => 'category',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'category',
                'related'        => FilterEndpointTestCategory::class,
                'searchable'     => true,
                'columns'        => [
                    ['name' => 'type', 'type' => 'string', 'searchable' => true],
                ],
            ],
        ];
    }
}

class ModelControllerFilterTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware();
        $this->withoutExceptionHandling();

        Schema::create('filter_endpoint_categories', function ($t) {
            $t->ulid('id')->primary();
            $t->string('type')->nullable();
            $t->timestamps();
        });

        Schema::create('filter_endpoint_records', function ($t) {
            $t->ulid('id')->primary();
            $t->ulid('category_id')->nullable();
            $t->string('name')->nullable();
            $t->integer('qty')->nullable();
            $t->boolean('is_active')->default(false);
            $t->date('born_on')->nullable();
            $t->datetime('started_at')->nullable();
            $t->timestamps();
        });

        FilterEndpointTestCategory::insert([
            ['id' => 'c1', 'type' => 'CatA', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'c2', 'type' => 'CatB', 'created_at' => now(), 'updated_at' => now()],
        ]);
        FilterEndpointTestRecord::insert([
            ['id' => 'r1', 'name' => 'Apple', 'qty' => 5, 'is_active' => true, 'category_id' => 'c1', 'born_on' => '2025-01-01', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r2', 'name' => 'Banana', 'qty' => 15, 'is_active' => false, 'category_id' => 'c2', 'born_on' => '2025-02-01', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r3', 'name' => 'Cherry', 'qty' => 25, 'is_active' => true, 'category_id' => 'c1', 'born_on' => '2025-03-01', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function postFilter(array $filters) {
        return $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->postJson(route('model'), [
                'model'   => FilterEndpointTestRecord::class,
                'filters' => $filters,
            ]);
    }

    public function test_old_operators_no_regression() {
        // scalar / =
        $res = $this->postFilter(['name' => 'Apple']);
        $res->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertEquals('r1', $res->json('data.0.id'));

        // >
        $res = $this->postFilter(['qty' => ['>' => 10]]);
        $this->assertCount(2, $res->json('data')); // r2, r3

        // in
        $res = $this->postFilter(['name' => ['in' => ['Apple', 'Banana']]]);
        $this->assertCount(2, $res->json('data')); // r1, r2

        // like
        $res = $this->postFilter(['name' => ['like' => 'App']]);
        $this->assertCount(1, $res->json('data')); // r1

        // group or
        $res = $this->postFilter([
            'or' => [
                'name' => 'Apple',
                'qty'  => ['>' => 20],
            ],
        ]);
        $this->assertCount(2, $res->json('data')); // r1, r3

        // relasi dot
        $res = $this->postFilter(['category.type' => 'CatA']);
        $this->assertCount(2, $res->json('data')); // r1, r3
    }

    public function test_new_operators_work() {
        // between
        $res = $this->postFilter(['qty' => ['between' => [10, 20]]]);
        $res->assertOk();
        $this->assertCount(1, $res->json('data')); // r2
        $this->assertEquals('r2', $res->json('data.0.id'));

        // date period
        $res = $this->postFilter(['born_on' => ['between' => ['2025-01-15', '2025-02-15']]]);
        $this->assertCount(1, $res->json('data')); // r2
        $this->assertEquals('r2', $res->json('data.0.id'));

        $res = $this->postFilter(['born_on' => ['>=' => '2025-02-01']]);
        $this->assertCount(2, $res->json('data')); // r2, r3

        // relasi nested object
        $res = $this->postFilter(['category' => ['type' => 'CatB']]);
        $this->assertCount(1, $res->json('data')); // r2
        $this->assertEquals('r2', $res->json('data.0.id'));
    }
}
