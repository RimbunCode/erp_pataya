<?php

namespace Tests\Unit\Core\DataTable\Group;

use App\Services\Core\DataTable\Group\GroupNodeQuery;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use stdClass;

/**
 * Finance Fase 1, Task 8.2 (Requirement 13.4): kolom `decimal(20,4)` dikembalikan MySQL sebagai string, termasuk
 * hasil `SUM/MIN/MAX` pada baris grup. Agregat grup di DataTable (`groupAggregate`: `debit`/`credit` General
 * Ledger, `total_debit`/`total_credit` Journal) harus tetap menjadi angka. SQLite tidak menghasilkan string
 * desimal, sehingga jalur akumulasi diuji langsung dengan baris berisi string.
 */
class GroupNodeQueryDecimalTest extends TestCase {
    /**
     * @param  list<array{column: string, fn: string, sqlColumn: string}>  $aggregates
     * @param  list<list<string|null>>  $rowValues  nilai `agg_0` per baris SQL
     * @return array<string, int|float|null>
     */
    private function aggregate(array $aggregates, array $rowValues): array {
        $reflection = new ReflectionClass(GroupNodeQuery::class);
        $query      = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('aggregates')->setValue($query, $aggregates);

        $accumulate = $reflection->getMethod('accumulate');
        $finalize   = $reflection->getMethod('finalizeAggregates');

        $acc = [];
        foreach ($rowValues as $values) {
            $row = new stdClass;
            foreach ($values as $index => $value) {
                $row->{"agg_{$index}"} = $value;
            }
            foreach ($aggregates as $index => $aggregate) {
                $args = [&$acc[$index], $aggregate['fn'], $row, $index];
                $accumulate->invokeArgs($query, $args);
            }
        }

        return $finalize->invoke($query, $acc);
    }

    public function test_sum_of_decimal_strings_is_numeric(): void {
        $result = $this->aggregate(
            [['column' => 'debit', 'fn' => 'sum', 'sqlColumn' => 'debit']],
            [['1000.1234'], ['2000.0001'], ['0.0000']],
        );

        $this->assertEqualsWithDelta(3000.1235, $result['debit'], 1e-9);
        $this->assertIsFloat($result['debit']);
    }

    public function test_single_decimal_string_is_coerced_to_number(): void {
        $result = $this->aggregate(
            [['column' => 'credit', 'fn' => 'sum', 'sqlColumn' => 'credit']],
            [['1500.5000']],
        );

        $this->assertSame(1500.5, $result['credit']);
    }

    public function test_min_and_max_of_decimal_strings_compare_numerically(): void {
        $min = $this->aggregate([['column' => 'debit', 'fn' => 'min', 'sqlColumn' => 'debit']], [['100.0000'], ['20.5000'], ['3000.0000']]);
        $max = $this->aggregate([['column' => 'debit', 'fn' => 'max', 'sqlColumn' => 'debit']], [['100.0000'], ['20.5000'], ['3000.0000']]);

        $this->assertSame(20.5, $min['debit']);
        $this->assertEquals(3000, $max['debit']);
    }
}
