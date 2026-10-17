<?php

namespace Tests\Unit;

use App\Services\Core\DataTable\Template\ExpressionSql;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Property 5 (clamp progress) dijalankan di SQLite in-memory (koneksi test).
 */
class ExpressionSqlTest extends TestCase {
    private function evaluateProgress(string $expr): mixed {
        $sql = ExpressionSql::progress($expr);

        return DB::selectOne("select {$sql} as v")->v;
    }

    /**
     * @return array<string, array{0: string, 1: int|float|null}>
     */
    public static function progressCases(): array {
        return [
            'negatif -> 0'        => ['-5', 0],
            'negatif kecil'       => ['-0.01', 0],
            'nol'                 => ['0', 0],
            'dalam rentang'       => ['45.25', 45.25],
            'pembulatan ke atas'  => ['12.345', 12.35],
            'pembulatan ke bawah' => ['12.344', 12.34],
            'tepat 100'           => ['100', 100],
            'di atas 100 -> 100'  => ['100.01', 100],
            'jauh di atas 100'    => ['9999', 100],
            'NULL -> NULL'        => ['NULL', null],
            'pembagi nol NULLIF'  => ['50.0 / NULLIF(0, 0) * 100', null],
            'rasio normal'        => ['1.0 / NULLIF(4, 0) * 100', 25],
            'rasio > 100'         => ['9.0 / NULLIF(4, 0) * 100', 100],
        ];
    }

    #[Test]
    #[DataProvider('progressCases')]
    public function progress_clamps_to_0_100_with_two_decimals(string $expr, int|float|null $expected): void {
        $actual = $this->evaluateProgress($expr);

        if ($expected === null) {
            $this->assertNull($actual);

            return;
        }
        $this->assertEqualsWithDelta($expected, (float) $actual, 0.0000001);
    }

    #[Test]
    public function progress_is_monotonic_and_bounded_over_a_range(): void {
        $previous = null;
        foreach ([-250.5, -1, 0, 0.004, 0.005, 1.234, 33.333, 50, 99.994, 99.996, 100, 100.4, 250.5] as $x) {
            $value = (float) $this->evaluateProgress((string) $x);

            $this->assertGreaterThanOrEqual(0, $value);
            $this->assertLessThanOrEqual(100, $value);
            $this->assertEqualsWithDelta(round($value, 2), $value, 0.0000001, 'maksimal 2 desimal');
            if ($previous !== null) {
                $this->assertGreaterThanOrEqual($previous, $value, "tidak turun pada x={$x}");
            }
            $previous = $value;
        }
    }

    #[Test]
    public function progress_evaluates_column_references_from_a_table(): void {
        $rows = DB::select('select ' . ExpressionSql::progress('a * 100.0 / NULLIF(b, 0)') . ' as v from (select 30 as a, 40 as b union all select 5, 0 union all select 50, 10) t');

        $values = array_map(fn ($r) => $r->v === null ? null : (float) $r->v, $rows);

        $this->assertEqualsWithDelta(75.0, $values[0], 0.0000001);
        $this->assertNull($values[1]);
        $this->assertEqualsWithDelta(100.0, $values[2], 0.0000001);
    }

    #[Test]
    public function for_column_wraps_number_and_currency_in_parentheses(): void {
        $this->assertSame('(a - b)', ExpressionSql::forColumn(['type' => 'number', 'expression' => 'a - b']));
        $this->assertSame('(a * 2)', ExpressionSql::forColumn(['type' => 'currency', 'expression' => 'a * 2']));
    }

    #[Test]
    public function for_column_uses_progress_clamp_for_progress_type(): void {
        $this->assertSame(
            ExpressionSql::progress('x / NULLIF(y, 0) * 100'),
            ExpressionSql::forColumn(['type' => 'progress', 'expression' => 'x / NULLIF(y, 0) * 100']),
        );
    }

    #[Test]
    public function for_column_returns_null_without_a_usable_expression(): void {
        $this->assertNull(ExpressionSql::forColumn(['type' => 'number']));
        $this->assertNull(ExpressionSql::forColumn(['type' => 'number', 'expression' => '']));
        $this->assertNull(ExpressionSql::forColumn(['type' => 'number', 'expression' => '   ']));
        $this->assertNull(ExpressionSql::forColumn(['type' => 'progress']));
        $this->assertNull(ExpressionSql::forColumn(['type' => 'number', 'expression' => ['x']]));
        $this->assertNull(ExpressionSql::forColumn([]));
    }

    #[Test]
    public function for_column_ignores_expression_on_unsupported_types(): void {
        $this->assertNull(ExpressionSql::forColumn(['type' => 'string', 'expression' => 'a || b']));
        $this->assertNull(ExpressionSql::forColumn(['expression' => 'a + b']));
    }
}
