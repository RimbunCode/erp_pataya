<?php

namespace Tests\Feature\Services\Core;

use App\Models\Model as AppModel;
use App\Services\Core\FilterEvaluator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

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
}

class FilterEvaluatorTest extends TestCase {
    use RefreshDatabase;

    /** @var array<string,array<string,mixed>> */
    private array $columns;

    protected function setUp(): void {
        parent::setUp();

        Schema::create('filter_test_records', function ($t) {
            $t->ulid('id')->primary();
            $t->string('name')->nullable();
            $t->integer('qty')->nullable();
            $t->decimal('price', 12, 2)->nullable();
            $t->boolean('is_active')->default(false);
            $t->string('status')->nullable();
            $t->date('born_on')->nullable();
            $t->datetime('started_at')->nullable();
            $t->boolean('is_example')->default(false);
            $t->timestamps();
        });

        $this->columns = [
            'name'       => ['name' => 'name', 'type' => 'string', 'searchable' => true],
            'qty'        => ['name' => 'qty', 'type' => 'number', 'searchable' => true],
            'price'      => ['name' => 'price', 'type' => 'currency', 'searchable' => true],
            'is_active'  => ['name' => 'is_active', 'type' => 'boolean', 'searchable' => true],
            'status'     => ['name' => 'status', 'type' => 'enum', 'searchable' => true, 'options' => ['draft', 'active', 'closed']],
            'born_on'    => ['name' => 'born_on', 'type' => 'date', 'searchable' => true],
            'started_at' => ['name' => 'started_at', 'type' => 'datetime', 'searchable' => true],
            'secret'     => ['name' => 'secret', 'type' => 'string', 'searchable' => false],
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
