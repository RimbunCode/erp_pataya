<?php

namespace Tests\Feature\Services\Core;

use App\Models\Model as AppModel;
use App\Services\Core\FilterEvaluator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Model stub kategori untuk menguji filter kolom DALAM relasi (category.type).
 */
class FilterTestCategory extends AppModel {
    use HasUlids;

    protected $table   = 'filter_test_categories';
    protected $guarded = ['id'];
    public $timestamps = true;
}

/**
 * Model stub dengan beragam type kolom untuk menguji FilterEvaluator
 * secara terisolasi dari konfigurasi model produksi.
 */
class FilterTestRecord extends AppModel {
    use HasUlids;

    protected $table   = 'filter_test_records';
    protected $guarded = ['id'];
    public $timestamps = true;

    protected function casts(): array {
        return [
            'is_active'  => 'boolean',
            'price'      => 'decimal:2',
            'started_at' => 'datetime',
            'born_on'    => 'date',
        ];
    }

    public function category(): BelongsTo {
        return $this->belongsTo(FilterTestCategory::class, 'category_id');
    }
}

class FilterEvaluatorTest extends TestCase {
    use RefreshDatabase;

    /** @var array<string,array<string,mixed>> */
    private array $columns;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('filter_test_categories', function ($t) {
            $t->ulid('id')->primary();
            $t->string('type')->nullable();
            $t->integer('threshold')->nullable();
            $t->date('valid_on')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });

        Schema::create('filter_test_records', function ($t) {
            $t->ulid('id')->primary();
            $t->ulid('category_id')->nullable();
            $t->string('name')->nullable();
            $t->string('alias')->nullable();
            $t->integer('qty')->nullable();
            $t->integer('min_qty')->nullable();
            $t->decimal('price', 12, 2)->nullable();
            $t->decimal('cost', 12, 2)->nullable();
            $t->decimal('max_price', 12, 2)->nullable();
            $t->boolean('is_active')->default(false);
            $t->string('status')->nullable();
            $t->date('born_on')->nullable();
            $t->date('deadline_on')->nullable();
            $t->datetime('started_at')->nullable();
            $t->json('tags')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });

        $this->columns = [
            'name'        => ['name' => 'name', 'type' => 'string', 'searchable' => true],
            'alias'       => ['name' => 'alias', 'type' => 'string', 'searchable' => true],
            'qty'         => ['name' => 'qty', 'type' => 'number', 'searchable' => true],
            'min_qty'     => ['name' => 'min_qty', 'type' => 'number', 'searchable' => true],
            'price'       => ['name' => 'price', 'type' => 'currency', 'searchable' => true],
            'cost'        => ['name' => 'cost', 'type' => 'currency', 'searchable' => true],
            'max_price'   => ['name' => 'max_price', 'type' => 'currency', 'searchable' => true],
            'is_active'   => ['name' => 'is_active', 'type' => 'boolean', 'searchable' => true],
            'status'      => ['name' => 'status', 'type' => 'enum', 'searchable' => true, 'options' => ['draft', 'active', 'closed']],
            'born_on'     => ['name' => 'born_on', 'type' => 'date', 'searchable' => true],
            'deadline_on' => ['name' => 'deadline_on', 'type' => 'date', 'searchable' => true],
            'started_at'  => ['name' => 'started_at', 'type' => 'datetime', 'searchable' => true],
            'tags'        => ['name' => 'tags', 'type' => 'formStatuses', 'searchable' => true, 'options' => ['draft', 'approved', 'closed', 'pending']],
            'secret'      => ['name' => 'secret', 'type' => 'string', 'searchable' => false],
            'category'    => [
                'name'           => 'category',
                'type'           => 'relation',
                'typeRelation'   => 'basic',
                'nameOfFunction' => 'category',
                'related'        => FilterTestCategory::class,
                'primaryKey'     => 'id',
                'searchable'     => true,
                'columns'        => [
                    ['name' => 'type', 'type' => 'string', 'searchable' => true],
                    ['name' => 'threshold', 'type' => 'number', 'searchable' => true],
                    ['name' => 'valid_on', 'type' => 'date', 'searchable' => true],
                ],
            ],
        ];
    }

    private function evaluator(): FilterEvaluator {
        return new FilterEvaluator($this->columns);
    }

    /**
     * @param  array<string,mixed>  $children
     */
    private function applyAnd(array $children): Builder {
        $tree = ['root' => ['k' => 'and', 'c' => $children]];
        $q    = FilterTestRecord::query();
        $this->evaluator()->apply($q, $tree);

        return $q;
    }

    private function seedRecords(): void {
        FilterTestRecord::insert([
            ['id' => 'r1', 'name' => 'Apple', 'qty' => 5, 'price' => 10.00, 'is_active' => true, 'status' => 'active', 'born_on' => '2025-03-10', 'started_at' => '2026-04-15 09:30:00', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r2', 'name' => 'Banana', 'qty' => 15, 'price' => 50.00, 'is_active' => false, 'status' => 'draft', 'born_on' => '2024-12-01', 'started_at' => '2026-07-01 12:00:00', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r3', 'name' => '', 'qty' => 0, 'price' => 0.00, 'is_active' => true, 'status' => 'closed', 'born_on' => null, 'started_at' => null, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r4', 'name' => null, 'qty' => null, 'price' => null, 'is_active' => false, 'status' => null, 'born_on' => '2026-05-20', 'started_at' => '2026-04-30 23:00:00', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_string_operators(): void {
        $this->seedRecords();
        $this->assertEquals(['r1'], $this->applyAnd(['i' => ['k' => 'name', 'o' => '=', 'v' => 'Apple']])->pluck('id')->all());
        // SQL three-valued logic: name != 'Apple' TIDAK termasuk NULL (r4); pakai !set untuk NULL
        $this->assertEqualsCanonicalizing(['r2', 'r3'], $this->applyAnd(['i' => ['k' => 'name', 'o' => '!=', 'v' => 'Apple']])->pluck('id')->all());
        $this->assertEquals(['r1'], $this->applyAnd(['i' => ['k' => 'name', 'o' => 'matches', 'v' => 'ppl']])->pluck('id')->all());
        $this->assertEquals(['r1'], $this->applyAnd(['i' => ['k' => 'name', 'o' => 'starts_with', 'v' => 'App']])->pluck('id')->all());
        $this->assertEquals(['r2'], $this->applyAnd(['i' => ['k' => 'name', 'o' => 'ends_with', 'v' => 'nana']])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->applyAnd(['i' => ['k' => 'name', 'o' => 'in', 'v' => 'Apple,Banana']])->pluck('id')->all());
    }

    public function test_numeric_operators(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r2'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '>', 'v' => 10]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '<', 'v' => 10]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => 'between', 'v' => '3,8']])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r3'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '!between', 'v' => '100,200']])->pluck('id')->all());
    }

    public function test_boolean_operator(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'is_active', 'o' => '=', 'v' => 'true']])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r2', 'r4'], $this->applyAnd(['i' => ['k' => 'is_active', 'o' => '=', 'v' => 'false']])->pluck('id')->all());
    }

    public function test_set_and_not_set_string_detects_null_and_empty(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->applyAnd(['i' => ['k' => 'name', 'o' => 'set', 'v' => null]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r3', 'r4'], $this->applyAnd(['i' => ['k' => 'name', 'o' => '!set', 'v' => null]])->pluck('id')->all());
    }

    public function test_set_non_string_checks_null_only(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r3'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => 'set', 'v' => null]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r4'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '!set', 'v' => null]])->pluck('id')->all());
    }

    public function test_enum_in(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'status', 'o' => 'in', 'v' => 'active,closed']])->pluck('id')->all());
    }

    /**
     * Kolom formStatuses disimpan sebagai JSON array; in/!in/has/!has harus
     * memakai JSON-contains (keanggotaan elemen), bukan whereIn pada blob.
     */
    public function test_form_statuses_json_array_membership(): void {
        FilterTestRecord::insert([
            ['id' => 's1', 'tags' => json_encode(['draft']), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 's2', 'tags' => json_encode(['draft', 'approved']), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 's3', 'tags' => json_encode(['closed']), 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 's4', 'tags' => null, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // in [draft] → memuat draft (s1, s2). NULL (s4) tidak match.
        $this->assertEqualsCanonicalizing(['s1', 's2'], $this->applyAnd(['i' => ['k' => 'tags', 'o' => 'in', 'v' => ['draft']]])->pluck('id')->all());
        // in [approved, closed] → s2 (approved) & s3 (closed).
        $this->assertEqualsCanonicalizing(['s2', 's3'], $this->applyAnd(['i' => ['k' => 'tags', 'o' => 'in', 'v' => ['approved', 'closed']]])->pluck('id')->all());
        // !in [draft] → tidak memuat draft: s3 (closed) & s4 (null).
        $this->assertEqualsCanonicalizing(['s3', 's4'], $this->applyAnd(['i' => ['k' => 'tags', 'o' => '!in', 'v' => ['draft']]])->pluck('id')->all());
        // has == in ; !has == !in (semantik identik untuk formStatuses).
        $this->assertEqualsCanonicalizing(['s1', 's2'], $this->applyAnd(['i' => ['k' => 'tags', 'o' => 'has', 'v' => ['draft']]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['s3', 's4'], $this->applyAnd(['i' => ['k' => 'tags', 'o' => '!has', 'v' => ['draft']]])->pluck('id')->all());
    }

    /**
     * Mode column same-table: bandingkan kolom kiri dengan kolom lain di tabel
     * yang sama via whereColumn (komparasi, in, between).
     */
    public function test_column_comparison_same_table(): void {
        FilterTestRecord::insert([
            ['id' => 'r1', 'qty' => 10, 'min_qty' => 5, 'price' => 100.00, 'cost' => 60.00, 'max_price' => 150.00, 'name' => 'Apple', 'alias' => 'Apple', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r2', 'qty' => 3, 'min_qty' => 8, 'price' => 200.00, 'cost' => 60.00, 'max_price' => 150.00, 'name' => 'Banana', 'alias' => 'Berry', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r3', 'qty' => 7, 'min_qty' => 7, 'price' => 80.00, 'cost' => 60.00, 'max_price' => 150.00, 'name' => 'Cherry', 'alias' => 'Cherry', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $col = fn (string $ref) => ['kind' => 'column', 'ref' => $ref];

        // qty > min_qty → r1 (10>5). r2 (3>8 no), r3 (7>7 no).
        $this->assertEqualsCanonicalizing(['r1'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '>', 'v' => $col('min_qty')]])->pluck('id')->all());
        // qty >= min_qty → r1, r3.
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '>=', 'v' => $col('min_qty')]])->pluck('id')->all());
        // name = alias → r1 (Apple), r3 (Cherry).
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'name', 'o' => '=', 'v' => $col('alias')]])->pluck('id')->all());
        // price between cost..max_price → r1 (100 in 60..150), r3 (80 in 60..150). r2 (200 no).
        $this->assertEqualsCanonicalizing(['r1', 'r3'], $this->applyAnd(['i' => ['k' => 'price', 'o' => 'between', 'v' => ['kind' => 'column', 'ref' => ['cost', 'max_price']]]])->pluck('id')->all());
    }

    /**
     * Mode column date/datetime: hanya tersedia di mode column (komparasi),
     * bandingkan dua kolom tanggal langsung.
     */
    public function test_column_comparison_dates(): void {
        FilterTestRecord::insert([
            ['id' => 'd1', 'born_on' => '2025-01-01', 'deadline_on' => '2025-06-01', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'd2', 'born_on' => '2025-09-01', 'deadline_on' => '2025-06-01', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // born_on < deadline_on → d1 (Jan<Jun). d2 (Sep<Jun no).
        $this->assertEqualsCanonicalizing(['d1'], $this->applyAnd(['i' => ['k' => 'born_on', 'o' => '<', 'v' => ['kind' => 'column', 'ref' => 'deadline_on']]])->pluck('id')->all());
    }

    /**
     * Mode column lintas tabel (relasi): qty > category.threshold via
     * correlated subquery (whereHas dengan kolom terkualifikasi tabel).
     */
    public function test_column_comparison_cross_table(): void {
        FilterTestCategory::insert([
            ['id' => 'c1', 'type' => 'a', 'threshold' => 5, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'c2', 'type' => 'b', 'threshold' => 20, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
        FilterTestRecord::insert([
            ['id' => 'x1', 'category_id' => 'c1', 'qty' => 10, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'x2', 'category_id' => 'c2', 'qty' => 10, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'x3', 'category_id' => 'c1', 'qty' => 3, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // qty > category.threshold → x1 (10>5). x2 (10>20 no), x3 (3>5 no).
        $this->assertEqualsCanonicalizing(['x1'], $this->applyAnd(['i' => ['k' => 'qty', 'o' => '>', 'v' => ['kind' => 'column', 'ref' => 'category.threshold']]])->pluck('id')->all());
    }

    /**
     * Type tidak kompatibel (string vs number) → item di-drop, hasil tak berubah.
     */
    public function test_column_comparison_type_incompatible_dropped(): void {
        FilterTestRecord::insert([
            ['id' => 'a1', 'name' => 'foo', 'qty' => 1, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'a2', 'name' => 'bar', 'qty' => 2, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // name > qty (string vs number) → drop → semua baris.
        $this->assertCount(2, $this->applyAnd(['i' => ['k' => 'name', 'o' => '>', 'v' => ['kind' => 'column', 'ref' => 'qty']]])->get());
    }

    public function test_relation_dot_notation_column_uses_where_has(): void {
        // Kolom DI DALAM relasi (category.type) → whereHas, bukan
        // where('category.type', ...) yang menghasilkan SQL invalid.
        FilterTestCategory::insert([
            ['id' => 'c1', 'type' => 'service', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'c2', 'type' => 'vehicle', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
        FilterTestRecord::insert([
            ['id' => 'r1', 'category_id' => 'c1', 'name' => 'A', 'is_active' => true, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r2', 'category_id' => 'c2', 'name' => 'B', 'is_active' => true, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'r3', 'category_id' => null, 'name' => 'C', 'is_active' => true, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // category.type = service → hanya r1
        $this->assertEqualsCanonicalizing(
            ['r1'],
            $this->applyAnd(['i' => ['k' => 'category.type', 'o' => '=', 'v' => 'service']])->pluck('id')->all(),
        );

        // OR dua kondisi relasi (payload user): service OR vehicle → r1 & r2
        $tree = ['root' => ['k' => 'and', 'c' => [
            'g' => ['k' => 'or', 'c' => [
                'a' => ['k' => 'category.type', 'o' => '=', 'v' => 'service'],
                'b' => ['k' => 'category.type', 'o' => '=', 'v' => 'vehicle'],
            ]],
        ]]];
        $q = FilterTestRecord::query();
        $this->evaluator()->apply($q, $tree);
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $q->pluck('id')->all());
    }

    public function test_nested_and_or_grouping(): void {
        $this->seedRecords();
        $tree = ['root' => ['k' => 'or', 'c' => [
            'g' => ['k' => 'and', 'c' => [
                'a' => ['k' => 'qty', 'o' => '>', 'v' => 10],
                'b' => ['k' => 'is_active', 'o' => '=', 'v' => 'false'],
            ]],
            'c' => ['k' => 'name', 'o' => '=', 'v' => 'Apple'],
        ]]];
        $q = FilterTestRecord::query();
        $this->evaluator()->apply($q, $tree);
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $q->pluck('id')->all());
    }

    public function test_period_month_quarter_half_year(): void {
        $this->seedRecords();
        // Shape reui: period + operator + year + index 0-based (month Apr=3, Q2=1, H1=0).
        $this->assertEqualsCanonicalizing(['r1', 'r4'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'month', 'operator' => 'is', 'year' => 2026, 'month' => 3]]])->pluck('id')->all());
        $this->assertEqualsCanonicalizing(['r1', 'r4'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'quarter', 'operator' => 'is', 'year' => 2026, 'quarter' => 1]]])->pluck('id')->all());
        // H1 2026 = Jan–Jun → r1 (Apr), r4 (Apr); r2 (Jul) = H2, r3 null
        $this->assertEqualsCanonicalizing(['r1', 'r4'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'half-year', 'operator' => 'is', 'year' => 2026, 'halfYear' => 0]]])->pluck('id')->all());
        // !in_period H1 → r2 (Jul, di luar H1); r3 null tidak masuk negasi range
        $this->assertEqualsCanonicalizing(['r2'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => '!in_period', 'v' => ['period' => 'half-year', 'operator' => 'is', 'year' => 2026, 'halfYear' => 0]]])->pluck('id')->all());
    }

    public function test_period_sub_operator_after(): void {
        $this->seedRecords();
        // operator "after" → started_at > akhir Q2 2026 (30 Jun) → r2 (Jul).
        $this->assertEqualsCanonicalizing(['r2'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'quarter', 'operator' => 'after', 'year' => 2026, 'quarter' => 1]]])->pluck('id')->all());
    }

    public function test_period_day_with_time_narrows_bounds(): void {
        $this->seedRecords();
        // started_at: r1=2026-04-15 09:30, r2=2026-07-01 12:00, r4=2026-04-30 23:00.
        // Time mempersempit batas (presisi menit) untuk datetime.

        // is 2026-04-15 09:30 → BETWEEN 09:30:00 AND 09:30:59 → r1.
        $this->assertEqualsCanonicalizing(['r1'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'day', 'operator' => 'is', 'startDate' => '2026-04-15T09:30:00']]])->pluck('id')->all());

        // on-or-after 2026-04-15 09:30 → >= 09:30:00 → r1, r2, r4.
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r4'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'day', 'operator' => 'on-or-after', 'startDate' => '2026-04-15T09:30:00']]])->pluck('id')->all());

        // before 2026-04-15 09:30 → < 09:30:00 → kosong (r1 tepat di batas, eksklusif).
        $this->assertEqualsCanonicalizing([], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'day', 'operator' => 'before', 'startDate' => '2026-04-15T09:30:00']]])->pluck('id')->all());

        // after 2026-04-15 09:30 → > 09:30:59 → r2, r4.
        $this->assertEqualsCanonicalizing(['r2', 'r4'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'day', 'operator' => 'after', 'startDate' => '2026-04-15T09:30:00']]])->pluck('id')->all());

        // Tanpa time (midnight) → seluruh hari: is 2026-04-15 00:00 → r1 (sehari penuh).
        $this->assertEqualsCanonicalizing(['r1'], $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => ['period' => 'day', 'operator' => 'is', 'startDate' => '2026-04-15T00:00:00']]])->pluck('id')->all());
    }

    // ---- in_period / !in_period dgn `v` DAFTAR: OR periode "Pada" (revisi 16) ----

    /** @return array<string,mixed> */
    private function monthIs(int $year, int $month): array {
        return ['period' => 'month', 'operator' => 'is', 'year' => $year, 'month' => $month];
    }

    /** @return array<string,mixed> */
    private function dayIs(string $date): array {
        return ['period' => 'day', 'operator' => 'is', 'startDate' => $date];
    }

    /**
     * @return list<string>
     */
    private function idsFor(string $column, string $op, mixed $value): array {
        return $this->applyAnd(['p' => ['k' => $column, 'o' => $op, 'v' => $value]])->pluck('id')->all();
    }

    public function test_period_in_is_or_of_periods_across_granularities(): void {
        $this->seedRecords();
        // started_at: r1=2026-04-15 09:30, r2=2026-07-01 12:00, r4=2026-04-30 23:00, r3=NULL.

        // Juli 2026 (idx 6) + hari 2026-04-15 -> r2 + r1.
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->idsFor('started_at', 'in_period', [$this->monthIs(2026, 6), $this->dayIs('2026-04-15T00:00:00')]));

        // H2 2026 + tahun 2025 (tak ada baris) -> r2 saja.
        $this->assertEqualsCanonicalizing(['r2'], $this->idsFor('started_at', 'in_period', [
            ['period' => 'half-year', 'operator' => 'is', 'year' => 2026, 'halfYear' => 1],
            ['period' => 'year', 'operator' => 'is', 'year' => 2025],
        ]));

        // Q2 2026 (quarter idx 1: Apr-Jun) + Juli -> r1, r4, r2 (r3 NULL tak masuk).
        $this->assertEqualsCanonicalizing(['r1', 'r2', 'r4'], $this->idsFor('started_at', 'in_period', [
            ['period' => 'quarter', 'operator' => 'is', 'year' => 2026, 'quarter' => 1],
            $this->monthIs(2026, 6),
        ]));
    }

    public function test_period_in_on_date_column_uses_date_bounds(): void {
        $this->seedRecords();
        // born_on (date): r1=2025-03-10, r2=2024-12-01, r4=2026-05-20, r3=NULL.
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->idsFor('born_on', 'in_period', [$this->dayIs('2025-03-10'), $this->monthIs(2024, 11)]));
        $this->assertEqualsCanonicalizing(['r4'], $this->idsFor('born_on', 'in_period', [['period' => 'year', 'operator' => 'is', 'year' => 2026]]));
    }

    public function test_period_in_datetime_minute_precision(): void {
        $this->seedRecords();
        // Berjam -> jendela menit (sama dgn in_period).
        $this->assertEqualsCanonicalizing(['r1'], $this->idsFor('started_at', 'in_period', [$this->dayIs('2026-04-15T09:30:00')]));
        $this->assertEqualsCanonicalizing([], $this->idsFor('started_at', 'in_period', [$this->dayIs('2026-04-15T09:31:00')]));
        // Campur: satu berjam (r1) + satu seluruh hari (2026-07-01 -> r2).
        $this->assertEqualsCanonicalizing(['r1', 'r2'], $this->idsFor('started_at', 'in_period', [$this->dayIs('2026-04-15T09:30:00'), $this->dayIs('2026-07-01T00:00:00')]));
    }

    public function test_period_not_in_is_not_of_or_and_excludes_null(): void {
        $this->seedRecords();
        // !in [April 2026] -> di luar April: r2 saja; r3 (NULL) tak masuk negasi.
        $this->assertEqualsCanonicalizing(['r2'], $this->idsFor('started_at', '!in_period', [$this->monthIs(2026, 3)]));
        // !in [April, Juli] -> tak ada yg tersisa selain NULL (dikecualikan).
        $this->assertEqualsCanonicalizing([], $this->idsFor('started_at', '!in_period', [$this->monthIs(2026, 3), $this->monthIs(2026, 6)]));
    }

    public function test_period_list_single_element_equals_single_object(): void {
        $this->seedRecords();
        $period = $this->monthIs(2026, 3);

        $this->assertEqualsCanonicalizing(
            $this->idsFor('started_at', 'in_period', $period),
            $this->idsFor('started_at', 'in_period', [$period]),
        );
        $this->assertEqualsCanonicalizing(
            $this->idsFor('started_at', '!in_period', $period),
            $this->idsFor('started_at', '!in_period', [$period]),
        );
    }

    public function test_period_in_invalid_values_add_no_condition(): void {
        $this->seedRecords();
        $noop = [
            'kosong'          => [],
            'skalar'          => ['2026-04-15'],
            'string'          => '2026-04-15',
            'bukan is'        => [['period' => 'month', 'operator' => 'after', 'year' => 2026, 'month' => 3]],
            'hari tanpa awal' => [['period' => 'day', 'operator' => 'is']],
        ];

        foreach ($noop as $label => $value) {
            $this->assertCount(4, $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => $value]])->get(), $label);
        }
    }

    public function test_legacy_in_on_date_column_is_skipped_silently(): void {
        $this->seedRecords();
        // Revisi 16: `in`/`!in` bukan operator date lagi (tanpa normalisasi) ->
        // item dilewati diam-diam, semua 4 baris tampil.
        $this->assertCount(4, $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in', 'v' => [$this->monthIs(2026, 3)]]])->get());
        $this->assertCount(4, $this->applyAnd(['p' => ['k' => 'born_on', 'o' => '!in', 'v' => [$this->monthIs(2026, 3)]]])->get());
    }

    public function test_period_in_skips_invalid_elements_but_applies_valid_ones(): void {
        $this->seedRecords();
        $this->assertEqualsCanonicalizing(['r1', 'r4'], $this->idsFor('started_at', 'in_period', [
            ['period' => 'day', 'operator' => 'is'],
            $this->monthIs(2026, 3),
        ]));
    }

    public function test_period_in_on_relation_dot_notation_column(): void {
        FilterTestCategory::insert([
            ['id' => 'c1', 'type' => 'a', 'valid_on' => '2026-03-01', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'c2', 'type' => 'b', 'valid_on' => '2026-08-15', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
        FilterTestRecord::insert([
            ['id' => 'n1', 'category_id' => 'c1', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'n2', 'category_id' => 'c2', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'n3', 'category_id' => null, 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->assertEqualsCanonicalizing(['n1'], $this->idsFor('category.valid_on', 'in_period', [$this->monthIs(2026, 2)]));
        $this->assertEqualsCanonicalizing(['n1', 'n2'], $this->idsFor('category.valid_on', 'in_period', [$this->monthIs(2026, 2), $this->monthIs(2026, 7)]));
        // Negasi di dalam relasi: hanya baris yg PUNYA relasi & di luar periode.
        $this->assertEqualsCanonicalizing(['n2'], $this->idsFor('category.valid_on', '!in_period', [$this->monthIs(2026, 2)]));
    }

    public function test_period_in_does_not_break_column_comparison_mode_for_dates(): void {
        FilterTestRecord::insert([
            ['id' => 'd1', 'born_on' => '2025-01-01', 'deadline_on' => '2025-06-01', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'd3', 'born_on' => '2025-06-01', 'deadline_on' => '2025-06-01', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Mode kolom: born_on IN (deadline_on) -> sama dgn deadline_on -> d3.
        $this->assertEqualsCanonicalizing(['d3'], $this->idsFor('born_on', 'in', ['kind' => 'column', 'ref' => ['deadline_on']]));
    }

    public function test_period_in_bindings_are_parameterized(): void {
        $sql = $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => [$this->monthIs(2026, 3), $this->monthIs(2026, 6)]]])->toSql();

        $this->assertStringContainsString('between ? and ?', strtolower($sql));
        $this->assertStringContainsString(' or ', strtolower($sql));
        $this->assertStringNotContainsString('2026', $sql);
    }

    public function test_whitelist_skips_non_searchable_and_invalid_operator(): void {
        $this->seedRecords();
        $this->assertCount(4, $this->applyAnd(['i' => ['k' => 'secret', 'o' => '=', 'v' => 'x']])->get());
        $this->assertCount(4, $this->applyAnd(['i' => ['k' => 'ghost', 'o' => '=', 'v' => 'x']])->get());
        $this->assertCount(4, $this->applyAnd(['i' => ['k' => 'is_active', 'o' => 'between', 'v' => '1,2']])->get());
    }

    public function test_bindings_are_parameterized(): void {
        $q = $this->applyAnd(['i' => ['k' => 'name', 'o' => '=', 'v' => "x'; DROP TABLE--"]]);
        $this->assertStringNotContainsString('DROP TABLE', $q->toSql());
        $this->assertContains("x'; DROP TABLE--", $q->getBindings());
    }

    public function test_apply_is_chainable_without_execution(): void {
        $q        = FilterTestRecord::query();
        $returned = $this->evaluator()->apply($q, ['root' => ['k' => 'and', 'c' => ['i' => ['k' => 'name', 'o' => '=', 'v' => 'Apple']]]]);
        $this->assertInstanceOf(Builder::class, $returned);
        $this->seedRecords();
        $this->assertEquals(1, $returned->paginate(10)->total());
    }

    public function test_empty_tree_returns_no_filter(): void {
        $this->seedRecords();
        $q = FilterTestRecord::query();
        $this->evaluator()->apply($q, ['root' => ['k' => 'and', 'c' => []]]);
        $this->assertCount(4, $q->get());
    }

    // ---- Property-based invariants --------------------------------------

    /**
     * Generate dataset string acak (campur null, '', berisi) lalu verifikasi
     * partisi sempurna: count(set) + count(!set) == total.
     */
    public function test_property_empty_null_partition_string(): void {
        $total = $this->seedRandom(40, 'name', fn () => fake()->randomElement([null, '', fake()->word()]));

        $set    = $this->applyAnd(['i' => ['k' => 'name', 'o' => 'set', 'v' => null]])->count();
        $notSet = $this->applyAnd(['i' => ['k' => 'name', 'o' => '!set', 'v' => null]])->count();

        $this->assertSame($total, $set + $notSet, 'set + !set harus menutup seluruh dataset');
        // !set hanya menangkap NULL atau '' ; tak ada overlap
        $this->assertSame(0, $this->countOverlap('name'));
    }

    /**
     * Verifikasi symmetry in/!in pada kolom non-null: count(in)+count(!in)==total.
     */
    public function test_property_in_not_in_symmetry(): void {
        $total   = $this->seedRandom(40, 'qty', fn () => fake()->numberBetween(1, 5));
        $targets = '2,4';

        $in    = $this->applyAnd(['i' => ['k' => 'qty', 'o' => 'in', 'v' => $targets]])->count();
        $notIn = $this->applyAnd(['i' => ['k' => 'qty', 'o' => '!in', 'v' => $targets]])->count();

        $this->assertSame($total, $in + $notIn, 'in + !in harus menutup dataset non-null');
    }

    /**
     * resolvePeriodBounds (lewat query) selalu menghasilkan rentang start<=end:
     * untuk berbagai period & nilai acak, baris di awal & akhir rentang ikut terfilter.
     */
    public function test_property_period_range_bounds_inclusive(): void {
        $cases = [
            ['v' => ['period' => 'month', 'operator' => 'is', 'year' => 2026, 'month' => 2], 'inside' => ['2026-03-01 00:00:00', '2026-03-31 23:59:59']],
            ['v' => ['period' => 'quarter', 'operator' => 'is', 'year' => 2026, 'quarter' => 0], 'inside' => ['2026-01-01 00:00:00', '2026-03-31 23:59:59']],
            ['v' => ['period' => 'half-year', 'operator' => 'is', 'year' => 2026, 'halfYear' => 1], 'inside' => ['2026-07-01 00:00:00', '2026-12-31 23:59:59']],
            ['v' => ['period' => 'year', 'operator' => 'is', 'year' => 2026], 'inside' => ['2026-01-01 00:00:00', '2026-12-31 23:59:59']],
        ];

        foreach ($cases as $i => $c) {
            FilterTestRecord::query()->delete();
            FilterTestRecord::insert([
                ['id' => "lo{$i}", 'started_at' => $c['inside'][0], 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
                ['id' => "hi{$i}", 'started_at' => $c['inside'][1], 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
                ['id' => "out{$i}", 'started_at' => '2025-01-01 00:00:00', 'is_example' => false, 'created_at' => now(), 'updated_at' => now()],
            ]);

            $ids = $this->applyAnd(['p' => ['k' => 'started_at', 'o' => 'in_period', 'v' => $c['v']]])->pluck('id')->all();
            $this->assertEqualsCanonicalizing(["lo{$i}", "hi{$i}"], $ids, "batas rentang {$c['v']['period']} harus inklusif");
        }
    }

    /**
     * @param  callable():mixed  $gen
     */
    private function seedRandom(int $n, string $column, callable $gen): int {
        $rows = [];
        for ($i = 0; $i < $n; $i++) {
            $rows[] = [
                'id'         => "p{$i}",
                $column      => $gen(),
                'is_example' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        FilterTestRecord::insert($rows);

        return $n;
    }

    private function countOverlap(string $column): int {
        $setIds    = $this->applyAnd(['i' => ['k' => $column, 'o' => 'set', 'v' => null]])->pluck('id')->all();
        $notSetIds = $this->applyAnd(['i' => ['k' => $column, 'o' => '!set', 'v' => null]])->pluck('id')->all();

        return count(array_intersect($setIds, $notSetIds));
    }
}
