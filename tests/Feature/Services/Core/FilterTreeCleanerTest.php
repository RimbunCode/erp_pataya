<?php

namespace Tests\Feature\Services\Core;

use App\Services\Core\FilterTreeCleaner;
use Tests\TestCase;

/**
 * Stub model terkait untuk menguji cleaner tidak men-drop filter relasi yang
 * valid (kolom anak dimuat lazily).
 */
class CleanerCategoryStub {
    /** @return list<array<string,mixed>> */
    public static function getColumns(int $maxDepth = 0, bool $includeIgnore = false, ...$excepts): array {
        return [
            ['name' => 'type', 'type' => 'string', 'searchable' => true],
            ['name' => 'threshold', 'type' => 'number', 'searchable' => true],
        ];
    }
}

/**
 * Unit cleaner: drop item invalid, collapse/drop grup kosong, value-shape
 * type-check. Tidak menyentuh DB.
 */
class FilterTreeCleanerTest extends TestCase {
    /** @var array<string,array<string,mixed>> */
    private array $columns = [
        'name'        => ['name' => 'name', 'type' => 'string', 'searchable' => true],
        'qty'         => ['name' => 'qty', 'type' => 'number', 'searchable' => true],
        'min_qty'     => ['name' => 'min_qty', 'type' => 'number', 'searchable' => true],
        'price'       => ['name' => 'price', 'type' => 'currency', 'searchable' => true],
        'tags'        => ['name' => 'tags', 'type' => 'formStatuses', 'searchable' => true, 'options' => ['draft', 'approved', 'closed']],
        'secret'      => ['name' => 'secret', 'type' => 'string', 'searchable' => false],
        'born_on'     => ['name' => 'born_on', 'type' => 'date', 'searchable' => true],
        'deadline_on' => ['name' => 'deadline_on', 'type' => 'date', 'searchable' => true],
        'started_at'  => ['name' => 'started_at', 'type' => 'datetime', 'searchable' => true],
        'category'    => [
            'name'         => 'category',
            'type'         => 'relation',
            'typeRelation' => 'basic',
            'related'      => CleanerCategoryStub::class,
            'columns'      => [], // kosong (mensimulasikan getColumns(1))
            'searchable'   => true,
        ],
    ];

    private function cleaner(): FilterTreeCleaner {
        return new FilterTreeCleaner($this->columns);
    }

    /**
     * @param  array<string,mixed>  $children
     * @return array<string,mixed>
     */
    private function clean(array $children): array {
        $tree = ['root' => ['k' => 'and', 'c' => $children]];

        return $this->cleaner()->clean($tree);
    }

    public function test_keeps_valid_item(): void {
        $out = $this->clean(['i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple']]);
        $this->assertCount(1, $out['root']['c']);
        $this->assertTrue($this->cleaner()->hasValidItems($out));
    }

    public function test_drops_item_with_empty_operator(): void {
        $out = $this->clean(['i1' => ['k' => 'name', 'o' => '', 'v' => 'x']]);
        $this->assertCount(0, $out['root']['c']);
        $this->assertFalse($this->cleaner()->hasValidItems($out));
    }

    public function test_drops_non_searchable_column(): void {
        $out = $this->clean(['i1' => ['k' => 'secret', 'o' => 'matches', 'v' => 'x']]);
        $this->assertCount(0, $out['root']['c']);
    }

    public function test_drops_invalid_operator_for_type(): void {
        // ">" tidak valid untuk string
        $out = $this->clean(['i1' => ['k' => 'name', 'o' => '>', 'v' => 'x']]);
        $this->assertCount(0, $out['root']['c']);
    }

    public function test_numeric_type_check(): void {
        $bad  = $this->clean(['i1' => ['k' => 'qty', 'o' => '=', 'v' => 'abc']]);
        $good = $this->clean(['i1' => ['k' => 'qty', 'o' => '=', 'v' => '12']]);
        $this->assertCount(0, $bad['root']['c']);
        $this->assertCount(1, $good['root']['c']);
    }

    public function test_between_requires_two_values(): void {
        $one = $this->clean(['i1' => ['k' => 'qty', 'o' => 'between', 'v' => [5]]]);
        $two = $this->clean(['i1' => ['k' => 'qty', 'o' => 'between', 'v' => [5, 10]]]);
        $this->assertCount(0, $one['root']['c']);
        $this->assertCount(1, $two['root']['c']);
    }

    public function test_drops_empty_group(): void {
        $out = $this->clean([
            'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple'],
            'g1' => ['k' => 'or', 'c' => [
                'i2' => ['k' => 'name', 'o' => '', 'v' => ''],
            ]],
        ]);
        $this->assertCount(1, $out['root']['c']);
        $this->assertArrayNotHasKey('g1', $out['root']['c']);
    }

    public function test_keeps_relation_dot_notation_items_in_group(): void {
        // Regresi: filter relasi category.type (kolom anak lazy-load) di dalam
        // grup OR tidak boleh ter-drop.
        $out = $this->clean([
            'g1' => ['k' => 'or', 'c' => [
                'i1' => ['k' => 'category.type', 'o' => '=', 'v' => 'service'],
                'i2' => ['k' => 'category.type', 'o' => '=', 'v' => 'vehicle'],
            ]],
            'i3' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple'],
        ]);

        $children = $out['root']['c'];
        $this->assertCount(2, $children, 'grup relasi + item name harus tetap');
        // grup tetap berupa group dgn 2 anak (tidak collapse, tidak drop)
        $group = $children['g1'] ?? null;
        $this->assertNotNull($group);
        $this->assertCount(2, $group['c']);
    }

    // ---- Mode column (column-ref) ---------------------------------------

    public function test_keeps_valid_column_ref(): void {
        // qty > min_qty (number vs number) → valid
        $out = $this->clean(['i1' => ['k' => 'qty', 'o' => '>', 'v' => ['kind' => 'column', 'ref' => 'min_qty']]]);
        $this->assertCount(1, $out['root']['c']);
    }

    public function test_drops_type_incompatible_column_ref(): void {
        // qty > name (number vs string) → drop
        $out = $this->clean(['i1' => ['k' => 'qty', 'o' => '>', 'v' => ['kind' => 'column', 'ref' => 'name']]]);
        $this->assertCount(0, $out['root']['c']);
    }

    public function test_drops_column_ref_unknown_column(): void {
        $out = $this->clean(['i1' => ['k' => 'qty', 'o' => '>', 'v' => ['kind' => 'column', 'ref' => 'ghost']]]);
        $this->assertCount(0, $out['root']['c']);
    }

    public function test_column_ref_between_requires_two_refs(): void {
        $one = $this->clean(['i1' => ['k' => 'qty', 'o' => 'between', 'v' => ['kind' => 'column', 'ref' => ['min_qty']]]]);
        $two = $this->clean(['i1' => ['k' => 'qty', 'o' => 'between', 'v' => ['kind' => 'column', 'ref' => ['min_qty', 'price']]]]);
        $this->assertCount(0, $one['root']['c']);
        $this->assertCount(1, $two['root']['c']);
    }

    public function test_drops_non_searchable_column_ref(): void {
        $out = $this->clean(['i1' => ['k' => 'name', 'o' => '=', 'v' => ['kind' => 'column', 'ref' => 'secret']]]);
        $this->assertCount(0, $out['root']['c']);
    }

    // ---- formStatuses ----------------------------------------------------

    public function test_keeps_form_statuses_has_and_in(): void {
        $has = $this->clean(['i1' => ['k' => 'tags', 'o' => 'has', 'v' => ['draft']]]);
        $in  = $this->clean(['i2' => ['k' => 'tags', 'o' => '!in', 'v' => ['draft', 'closed']]]);
        $this->assertCount(1, $has['root']['c']);
        $this->assertCount(1, $in['root']['c']);
    }

    public function test_drops_form_statuses_empty_list(): void {
        $out = $this->clean(['i1' => ['k' => 'tags', 'o' => 'in', 'v' => []]]);
        $this->assertCount(0, $out['root']['c']);
    }

    public function test_collapses_single_child_group(): void {
        // grup dengan satu item valid → item naik menggantikan grup
        $out = $this->clean([
            'g1' => ['k' => 'or', 'c' => [
                'i1' => ['k' => 'name', 'o' => 'matches', 'v' => 'Apple'],
                'i2' => ['k' => '', 'o' => '', 'v' => ''],
            ]],
        ]);
        $children = $out['root']['c'];
        $this->assertCount(1, $children);
        // bukan grup lagi (sudah collapse)
        $node = reset($children);
        $this->assertArrayNotHasKey('c', $node);
        $this->assertSame('matches', $node['o']);
    }

    // ---- in_period / !in_period dgn `v` DAFTAR periode "Pada" (revisi 16) ----

    /** @return array<string,mixed> */
    private function monthPeriod(int $year = 2026, int $month = 3): array {
        return ['period' => 'month', 'operator' => 'is', 'year' => $year, 'month' => $month];
    }

    public function test_keeps_period_list_in_period_for_date_and_datetime(): void {
        $list = [$this->monthPeriod(2026, 0), ['period' => 'day', 'operator' => 'is', 'startDate' => '2026-04-15'], ['period' => 'year', 'operator' => 'is', 'year' => 2024]];

        $out = $this->clean([
            'a' => ['k' => 'born_on', 'o' => 'in_period', 'v' => $list],
            'b' => ['k' => 'started_at', 'o' => 'in_period', 'v' => $list],
        ]);

        $this->assertCount(2, $out['root']['c']);
        $this->assertSame($list, $out['root']['c']['a']['v']);
    }

    public function test_keeps_negated_period_list_and_single_element_list(): void {
        $out = $this->clean([
            'a' => ['k' => 'born_on', 'o' => '!in_period', 'v' => [$this->monthPeriod(), $this->monthPeriod(2027, 1)]],
            'b' => ['k' => 'born_on', 'o' => 'in_period', 'v' => [$this->monthPeriod()]],
        ]);

        $this->assertCount(2, $out['root']['c']);
    }

    public function test_keeps_exactly_max_period_values_and_drops_more(): void {
        $max  = FilterTreeCleaner::MAX_PERIOD_VALUES;
        $make = fn (int $n) => array_map(fn ($i) => ['period' => 'year', 'operator' => 'is', 'year' => 2000 + $i], range(0, $n - 1));

        $ok   = $this->clean(['a' => ['k' => 'born_on', 'o' => 'in_period', 'v' => $make($max)]]);
        $over = $this->clean(['a' => ['k' => 'born_on', 'o' => 'in_period', 'v' => $make($max + 1)]]);

        $this->assertSame(20, $max);
        $this->assertCount(1, $ok['root']['c']);
        $this->assertCount(0, $over['root']['c']);
    }

    public function test_drops_invalid_period_lists(): void {
        $invalid = [
            'kosong'             => [],
            'skalar'             => ['2026-01-01', '2026-02-01'],
            'string'             => '2026-01-01,2026-02-01',
            'null'               => null,
            'elemen bukan is'    => [$this->monthPeriod(), ['period' => 'month', 'operator' => 'after', 'year' => 2026, 'month' => 1]],
            'elemen between'     => [['period' => 'day', 'operator' => 'between', 'startDate' => '2026-01-01', 'endDate' => '2026-01-31']],
            'hari tanpa start'   => [['period' => 'day', 'operator' => 'is']],
            'periode tanpa year' => [['period' => 'month', 'operator' => 'is', 'month' => 1]],
            'elemen skalar'      => [$this->monthPeriod(), 'x'],
            'kunci non-list'     => ['a' => $this->monthPeriod(), 'b' => $this->monthPeriod(2027)],
        ];

        foreach ($invalid as $label => $value) {
            foreach (['born_on', 'started_at'] as $column) {
                foreach (['in_period', '!in_period'] as $op) {
                    $out = $this->clean(['a' => ['k' => $column, 'o' => $op, 'v' => $value]]);
                    $this->assertCount(0, $out['root']['c'], "{$label} ({$column} {$op}) harus di-drop");
                }
            }
        }
    }

    public function test_in_period_single_object_any_condition_still_valid(): void {
        $out = $this->clean([
            'a' => ['k' => 'born_on', 'o' => 'in_period', 'v' => $this->monthPeriod()],
            'b' => ['k' => 'born_on', 'o' => '!in_period', 'v' => ['period' => 'day', 'operator' => 'after', 'startDate' => '2026-01-01']],
        ]);

        $this->assertCount(2, $out['root']['c']);
    }

    public function test_drops_legacy_in_on_date_but_column_ref_in_still_works(): void {
        $out = $this->clean([
            'a' => ['k' => 'born_on', 'o' => 'in', 'v' => [$this->monthPeriod()]],
            'b' => ['k' => 'started_at', 'o' => '!in', 'v' => [$this->monthPeriod()]],
            'c' => ['k' => 'born_on', 'o' => 'in', 'v' => ['kind' => 'column', 'ref' => ['deadline_on']]],
        ]);

        // `in`/`!in` daftar periode (Revisi 11) TIDAK dinormalisasi -> di-drop;
        // `in` mode kolom (bandingkan dgn kolom lain) tak terpengaruh.
        $this->assertSame(['c'], array_keys($out['root']['c']));
    }
}
