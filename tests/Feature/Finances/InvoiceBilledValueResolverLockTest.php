<?php

namespace Tests\Feature\Finances;

use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Finances\InvoiceBilledValueResolver;
use Illuminate\Database\Query\Grammars\MySqlGrammar;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Pada MySQL REPEATABLE READ, nilai tertagih untuk toleransi harus dibaca dengan FOR UPDATE di titik
 * approve (query item dan subquery invoice). SQLite mengabaikan lock, jadi query dikompilasi dengan
 * grammar MySQL; perilaku MySQL nyata tidak teruji di sini.
 */
class InvoiceBilledValueResolverLockTest extends TestCase {
    public static function invoiceItemProvider(): array {
        return [
            'purchase' => [PurchaseInvoiceItem::class, 'purchaseInvoice', 'purchase_order_item_id'],
            'sales'    => [SalesInvoiceItem::class, 'salesInvoice', 'sales_order_item_id'],
        ];
    }

    private function mysqlSql(string $itemClass, string $relation, string $column, bool $lock): string {
        $query   = app(InvoiceBilledValueResolver::class)->billedItemsQuery($itemClass, $relation, $column, ['source-1'], 'excluded-invoice', $lock);
        $grammar = new MySqlGrammar(DB::connection());

        return $grammar->compileSelect($query->toBase());
    }

    #[Test]
    #[DataProvider('invoiceItemProvider')]
    public function lock_adds_for_update_to_the_outer_query_and_the_invoice_subquery(string $itemClass, string $relation, string $column): void {
        $sql = $this->mysqlSql($itemClass, $relation, $column, true);

        $this->assertSame(2, substr_count($sql, 'for update'), $sql);
        $this->assertStringContainsString('exists (select', $sql);
        $this->assertMatchesRegularExpression('/exists \(select .*for update\) .*for update$/s', $sql, 'Subquery dan query luar masing-masing berklausa for update.');
    }

    #[Test]
    #[DataProvider('invoiceItemProvider')]
    public function without_lock_there_is_no_locking_clause(string $itemClass, string $relation, string $column): void {
        $this->assertStringNotContainsString('for update', $this->mysqlSql($itemClass, $relation, $column, false));
    }
}
