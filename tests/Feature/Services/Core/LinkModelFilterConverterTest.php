<?php

namespace Tests\Feature\Services\Core;

use App\Models\Model as AppModel;
use App\Services\Core\FilterEvaluator;
use App\Services\Core\LinkModelFilterConverter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ConverterTestCategory extends AppModel {
    use HasUlids;

    protected $table   = 'converter_test_categories';
    protected $guarded = ['id'];
    public $timestamps = true;
}

class ConverterTestRecord extends AppModel {
    use HasUlids;

    protected $table   = 'converter_test_records';
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
        return $this->belongsTo(ConverterTestCategory::class, 'category_id');
    }
}

class LinkModelFilterConverterTest extends TestCase {
    use RefreshDatabase;

    private array $columns;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('converter_test_categories', function ($t) {
            $t->ulid('id')->primary();
            $t->string('type')->nullable();
            $t->timestamps();
        });

        Schema::create('converter_test_records', function ($t) {
            $t->ulid('id')->primary();
            $t->ulid('category_id')->nullable();
            $t->string('name')->nullable();
            $t->integer('qty')->nullable();
            $t->integer('min_qty')->nullable();
            $t->boolean('is_active')->default(false);
            $t->date('born_on')->nullable();
            $t->datetime('started_at')->nullable();
            $t->json('formStatuses')->nullable();
            $t->timestamps();
        });

        $this->columns = [
            'name'         => ['name' => 'name', 'type' => 'string'],
            'qty'          => ['name' => 'qty', 'type' => 'number'],
            'min_qty'      => ['name' => 'min_qty', 'type' => 'number'],
            'is_active'    => ['name' => 'is_active', 'type' => 'boolean'],
            'born_on'      => ['name' => 'born_on', 'type' => 'date'],
            'started_at'   => ['name' => 'started_at', 'type' => 'datetime'],
            'formStatuses' => ['name' => 'formStatuses', 'type' => 'formStatuses'],
            'category'     => [
                'name'           => 'category',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'category',
                'related'        => ConverterTestCategory::class,
                'columns'        => [
                    ['name' => 'type', 'type' => 'string'],
                ],
            ],
            'invalid_col' => ['name' => 'invalid_col', 'type' => 'unknown_type'],
        ];
    }

    private function applyLinkModel(array $linkFilters): Builder {
        $converter = new LinkModelFilterConverter($this->columns);
        $tree      = $converter->toTree($linkFilters);
        $q         = ConverterTestRecord::query();
        (new FilterEvaluator($this->columns))->apply($q, $tree);

        return $q;
    }

    private function seedRecords(): void {
        ConverterTestCategory::insert([
            ['id' => 'c1', 'type' => 'A', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'c2', 'type' => 'B', 'created_at' => now(), 'updated_at' => now()],
        ]);
        ConverterTestRecord::insert([
            ['id' => 'r1', 'name' => 'Apple', 'qty' => 5, 'min_qty' => 1, 'is_active' => true, 'category_id' => 'c1', 'born_on' => '2025-01-01', 'started_at' => '2025-01-01 10:00:00', 'formStatuses' => json_encode(['draft']), 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r2', 'name' => 'Banana', 'qty' => 15, 'min_qty' => 10, 'is_active' => false, 'category_id' => 'c2', 'born_on' => '2025-02-01', 'started_at' => '2025-02-01 10:00:00', 'formStatuses' => json_encode(['approved']), 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r3', 'name' => 'Cherry', 'qty' => 25, 'min_qty' => 30, 'is_active' => true, 'category_id' => 'c1', 'born_on' => '2025-03-01', 'started_at' => '2025-03-01 10:00:00', 'formStatuses' => json_encode(['closed']), 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_scalar_and_operator_mapping() {
        $this->seedRecords();

        // scalar -> =
        $this->assertEqualsCanonicalizing(['r1'], $this->applyLinkModel(['name' => 'Apple'])->pluck('id')->all());

        // not/notEqual -> !=
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['name' => ['not' => 'Apple']])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['name' => ['notEqual' => 'Apple']])->pluck('id')->all());

        // notIn -> !in
        $this->assertEqualsCanonicalizing(['r3'], $this->applyLinkModel(['name' => ['notIn' => ['Apple', 'Banana']]])->pluck('id')->all());

        // notLike -> !matches
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['name' => ['notLike' => 'App']])->pluck('id')->all());

        // like -> matches
        $this->assertEqualsCanonicalizing(['r1'], $this->applyLinkModel(['name' => ['like' => 'App']])->pluck('id')->all());

        // in
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->applyLinkModel(['name' => ['in' => ['Apple', 'Banana']]])->pluck('id')->all());

        // > >= < <=
        $this->assertEqualsCanonicalizing(['r3'], $this->applyLinkModel(['qty' => ['>' => 20]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['qty' => ['>=' => 15]])->pluck('id')->all());

        // between
        $this->assertEqualsCanonicalizing(['r2'], $this->applyLinkModel(['qty' => ['between' => [10, 20]]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyLinkModel(['qty' => ['notBetween' => [10, 20]]])->pluck('id')->all());
    }

    public function test_nested_boolean_groups() {
        $this->seedRecords();

        // qty > 10 AND (name = Apple OR is_active = false)
        // LinkModel filter: { qty: { ">": 10 }, or: { name: "Apple", is_active: false } }
        $filters = [
            'qty' => ['>' => 10],
            'or'  => [
                'name'      => 'Apple',
                'is_active' => false,
            ],
        ];
        $this->assertEqualsCanonicalizing(['r2'], $this->applyLinkModel($filters)->pluck('id')->all());

        // object operator multiple
        $filters = [
            'qty' => ['>' => 10, '<' => 20],
        ];
        $this->assertEqualsCanonicalizing(['r2'], $this->applyLinkModel($filters)->pluck('id')->all());
    }

    public function test_relations_dot_and_nested_and_by_id() {
        $this->seedRecords();

        // dot notation
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyLinkModel(['category.type' => 'A'])->pluck('id')->all());

        // nested object relation
        $this->assertEqualsCanonicalizing(['r2'], $this->applyLinkModel(['category' => ['type' => 'B']])->pluck('id')->all());

        // by id
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyLinkModel(['category' => ['in' => ['c1']]])->pluck('id')->all());
    }

    public function test_date_converts_to_in_period() {
        $this->seedRecords();

        // born_on > 2025-01-15 -> after
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['born_on' => ['>' => '2025-01-15']])->pluck('id')->all());

        // born_on between
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->applyLinkModel(['born_on' => ['between' => ['2025-01-01', '2025-02-15']]])->pluck('id')->all());

        // born_on not
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyLinkModel(['born_on' => ['not' => '2025-01-01']])->pluck('id')->all());

        // Assert bentuk value period dihasilkan dengan benar di test ini dgn nge-mock jika perlu,
        // Tapi e2e test ke db membuktikan mapping filter evaluator tereksekusi secara valid,
        // krn filter evaluator hanya mengenali bentuk {period:'day', operator:..., startDate:...} utk datetime
    }

    public function test_form_statuses_and_column_mode() {
        $this->seedRecords();

        // jsonContains
        $this->assertEqualsCanonicalizing(['r1'], $this->applyLinkModel(['formStatuses' => ['jsonContains' => 'draft']])->pluck('id')->all());

        // column mode
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->applyLinkModel(['qty' => ['column' => ['>' => 'min_qty']]])->pluck('id')->all());
    }

    public function test_safe_skip_invalid_operators_and_columns() {
        $this->seedRecords();

        // operator aneh, kolom tidak ada
        $q = $this->applyLinkModel(['invalid_col' => 'x', 'name' => ['invalid_op' => 'y']]);

        // seharusnya mengembalikan semua r1, r2, r3 tanpa melempar error
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r3'], $q->pluck('id')->all());

        // jsonContains di luar formStatuses -> skip
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r3'], $this->applyLinkModel(['name' => ['jsonContains' => 'App']])->pluck('id')->all());

        // raw(...) skip
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r3'], $this->applyLinkModel(['raw(1=1)' => 'yes'])->pluck('id')->all());
    }
}
