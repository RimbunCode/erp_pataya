<?php

namespace Tests\Feature\Migration;

use Closure;
use Illuminate\Database\MySqlConnection;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class StockLedgerTransactionDateMigrationTest extends TestCase {
    public function test_mysql_add_column_does_not_depend_on_is_valuated(): void {
        $connection = new MySqlConnection(null, 'testing');
        $connection->useDefaultSchemaGrammar();
        $statements = [];
        Schema::shouldReceive('table')->twice()->with('stock_ledger_entries', Mockery::type(Closure::class))
            ->andReturnUsing(function (string $table, Closure $callback) use ($connection, &$statements): void {
                $blueprint  = new Blueprint($connection, $table, $callback);
                $statements = array_merge($statements, $blueprint->toSql());
            });
        $query = Mockery::mock(Builder::class);
        $query->shouldReceive('whereNull')->once()->with('transaction_date')->andReturnSelf();
        $query->shouldReceive('update')->once()->andReturn(1);
        DB::shouldReceive('table')->once()->with('stock_ledger_entries')->andReturn($query);
        DB::shouldReceive('raw')->once()->with('created_at')->andReturn(new Expression('created_at'));

        $migration = require database_path('migrations/2026_08_09_084317_add_transaction_date_to_stock_ledger_entries_table.php');
        $migration->up();

        $this->assertSame('alter table `stock_ledger_entries` add `transaction_date` datetime null', $statements[0]);
        $this->assertStringContainsString('modify `transaction_date` datetime not null', $statements[1]);
    }
}
