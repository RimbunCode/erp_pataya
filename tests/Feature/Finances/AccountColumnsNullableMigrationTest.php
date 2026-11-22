<?php

namespace Tests\Feature\Finances;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3: migrasi `make_account_columns_nullable_on_payment_entries_and_additional_costs`
 * membuat kolom akun Payment Entry dan biaya tambahan boleh null; `down()` hanya mengembalikan NOT NULL bila tidak
 * ada baris tanpa akun, dan view laporan yang membaca `payment_entries` tetap utuh.
 */
class AccountColumnsNullableMigrationTest extends TestCase {
    use RefreshDatabase;

    private const array COLUMNS = [
        'payment_entries'  => ['account_paid_to_id', 'account_paid_from_id'],
        'additional_costs' => ['expense_account_id'],
    ];

    private function migration(): Migration {
        $files = glob(database_path('migrations/*_make_account_columns_nullable_on_payment_entries_and_additional_costs.php'));
        $this->assertCount(1, $files);

        return require $files[0];
    }

    private function isNullable(string $table, string $column): bool {
        return (bool) collect(Schema::getColumns($table))->firstWhere('name', $column)['nullable'];
    }

    private function assertNullability(bool $expected): void {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                $this->assertSame($expected, $this->isNullable($table, $column), "{$table}.{$column}");
            }
        }
    }

    public function test_columns_are_nullable_after_migrating(): void {
        $this->assertNullability(true);
    }

    public function test_down_restores_not_null_and_up_makes_them_nullable_again(): void {
        $migration = $this->migration();

        $migration->down();
        $this->assertNullability(false);
        $this->assertSame(0, DB::table('report_sales_invoices')->count(), 'View laporan tetap dapat dibaca.');

        $migration->up();
        $this->assertNullability(true);
        $this->assertSame(0, DB::table('report_purchase_invoices')->count(), 'View laporan tetap dapat dibaca.');
    }

    public function test_down_refuses_before_any_ddl_when_rows_without_account_exist(): void {
        $now = now();
        DB::table('additional_costs')->insert([
            'id'                 => (string) Str::ulid(),
            'expense_account_id' => null,
            'purpose'            => 'Angkut',
            'amount'             => 100,
            'created_at'         => $now,
            'updated_at'         => $now,
        ]);

        try {
            $this->migration()->down();
            $this->fail('down() harus menolak saat ada baris tanpa akun.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('additional_costs.expense_account_id', $e->getMessage());
            $this->assertStringContainsString('1 baris', $e->getMessage());
        }

        $this->assertNullability(true);
    }
}
