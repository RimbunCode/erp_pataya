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
    public static function getColumns(int $maxDepth = 0): array {
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
        'name'     => ['name' => 'name', 'type' => 'string', 'searchable' => true],
        'qty'      => ['name' => 'qty', 'type' => 'number', 'searchable' => true],
        'min_qty'  => ['name' => 'min_qty', 'type' => 'number', 'searchable' => true],
        'price'    => ['name' => 'price', 'type' => 'currency', 'searchable' => true],
        'tags'     => ['name' => 'tags', 'type' => 'formStatuses', 'searchable' => true, 'options' => ['draft', 'approved', 'closed']],
        'secret'   => ['name' => 'secret', 'type' => 'string', 'searchable' => false],
        'category' => [
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
}
