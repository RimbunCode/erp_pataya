<?php

namespace Tests\Unit\Core\DataTable\Group;

use App\Services\Core\DataTable\Group\GroupColumnGate;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Sanitasi `groupAggregate` (spec datatable2-group-tree, Requirement 9.1-9.2;
 * Property 5): config keliru diabaikan DIAM-DIAM, tidak pernah jadi SQL error.
 */
class GroupColumnGateTest extends TestCase {
    #[Test]
    public function aggregates_keeps_only_whitelisted_functions_on_real_numeric_columns(): void {
        $columns = [
            ['name' => 'total', 'type' => 'currency', 'groupAggregate' => 'sum'],
            ['name' => 'qty', 'type' => 'number', 'groupAggregate' => 'avg'],
            ['name' => 'lowest', 'type' => 'number', 'groupAggregate' => 'min'],
            ['name' => 'highest', 'type' => 'number', 'groupAggregate' => 'max'],
        ];

        $this->assertSame([
            ['column' => 'total', 'fn' => 'sum', 'sqlColumn' => 'total'],
            ['column' => 'qty', 'fn' => 'avg', 'sqlColumn' => 'qty'],
            ['column' => 'lowest', 'fn' => 'min', 'sqlColumn' => 'lowest'],
            ['column' => 'highest', 'fn' => 'max', 'sqlColumn' => 'highest'],
        ], GroupColumnGate::aggregates($columns));
    }

    #[Test]
    public function aggregates_silently_ignores_invalid_configuration(): void {
        $columns = [
            ['name' => 'unknown_fn', 'type' => 'number', 'groupAggregate' => 'median'],
            ['name' => 'upper_fn', 'type' => 'number', 'groupAggregate' => 'SUM'],
            ['name' => 'not_string_fn', 'type' => 'number', 'groupAggregate' => ['sum']],
            ['name' => 'string_col', 'type' => 'string', 'groupAggregate' => 'sum'],
            ['name' => 'relation_col', 'type' => 'relation', 'groupAggregate' => 'sum'],
            ['name' => 'derived_col', 'type' => 'number', 'groupAggregate' => 'sum', 'derived' => true],
            ['name' => 'bad name; drop', 'type' => 'number', 'groupAggregate' => 'sum'],
            ['name' => 'no_aggregate', 'type' => 'number'],
            ['type' => 'number', 'groupAggregate' => 'sum'], // tanpa name
        ];

        $this->assertSame([], GroupColumnGate::aggregates($columns));
    }

    #[Test]
    public function aggregates_physical_column_with_depends_on_is_still_valid(): void {
        // `dependsOn` BUKAN penanda turunan (kolom fisik pun bisa punya) -- sama
        // dgn gate `groupable`; yang menolak hanya flag `derived`.
        $columns = [['name' => 'total', 'type' => 'number', 'groupAggregate' => 'sum', 'dependsOn' => ['total', 'qty']]];

        $this->assertCount(1, GroupColumnGate::aggregates($columns));
    }
}
