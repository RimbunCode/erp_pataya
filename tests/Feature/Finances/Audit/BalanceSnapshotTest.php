<?php

namespace Tests\Feature\Finances\Audit;

use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Audit\BalanceSnapshotService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 0, Task 3.3: header CSV, jumlah baris = jumlah akun, akun tanpa transaksi bernilai nol,
 * `balance_type` kosong ditandai `note`, dan rumus `difference` (net bertanda debit − kredit).
 */
class BalanceSnapshotTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class]);
    }

    /**
     * @return list<array<string, string>>
     */
    private function snapshot(): array {
        $handle = fopen('php://temp', 'w+');
        (new BalanceSnapshotService)->write($handle);
        rewind($handle);

        $header = fgetcsv($handle);
        $rows   = [];
        while (($line = fgetcsv($handle)) !== false) {
            $rows[] = array_combine($header, $line);
        }
        fclose($handle);

        return $rows;
    }

    private function row(array $rows, Account $account): array {
        return collect($rows)->firstWhere('account_id', $account->id);
    }

    public function test_header_matches_the_specified_columns(): void {
        $handle = fopen('php://temp', 'w+');
        (new BalanceSnapshotService)->write($handle);
        rewind($handle);

        $this->assertSame(
            ['account_id', 'account_number', 'account_name', 'root_type', 'balance_type', 'sum_debit', 'sum_credit', 'net', 'balance_amount', 'difference', 'note'],
            fgetcsv($handle),
        );
    }

    public function test_one_row_per_account_including_accounts_without_transactions(): void {
        $cash   = $this->makeAccount('1101', 'Kas');
        $unused = $this->makeAccount('1102', 'Bank');
        $sales  = $this->makeAccount('4101', 'Penjualan', 'income', 'credit');
        $this->makeBalancedPosting($this->makeStockEntry(), $cash, $sales, 100);

        $rows = $this->snapshot();

        $this->assertCount(Account::withTrashed()->count(), $rows);
        $this->assertSame('0.0000', $this->row($rows, $unused)['sum_debit']);
        $this->assertSame('0.0000', $this->row($rows, $unused)['net']);
        $this->assertSame('100.0000', $this->row($rows, $cash)['sum_debit']);
        $this->assertSame('100.0000', $this->row($rows, $sales)['sum_credit']);
    }

    public function test_null_balance_type_is_flagged_in_note(): void {
        $odd = $this->makeAccount('9999', 'Tanpa Tipe', 'asset', null);

        $row = $this->row($this->snapshot(), $odd);

        $this->assertSame('', $row['balance_type']);
        $this->assertSame('balance_type kosong', $row['note']);
        $this->assertSame('0.0000', $row['difference']);
    }

    public function test_difference_uses_signed_net_for_debit_and_credit_normal_accounts(): void {
        // Meniru konvensi StockEntryService: sisi debit +jumlah, sisi kredit −jumlah pada balance_amount.
        $stock    = $this->makeAccount('1301', 'Persediaan', 'asset', 'debit', 'stock', 100);
        $variance = $this->makeAccount('3101', 'Selisih', 'equity', 'credit', null, -100);
        $this->makeBalancedPosting($this->makeStockEntry(), $stock, $variance, 100);

        $rows = $this->snapshot();

        $this->assertSame('100.0000', $this->row($rows, $stock)['net']);
        $this->assertSame('0.0000', $this->row($rows, $stock)['difference']);
        $this->assertSame('-100.0000', $this->row($rows, $variance)['net']);
        $this->assertSame('0.0000', $this->row($rows, $variance)['difference']);
    }

    public function test_difference_exposes_cached_balance_that_does_not_match_the_ledger(): void {
        $cash  = $this->makeAccount('1101', 'Kas', 'asset', 'debit', null, 30);
        $sales = $this->makeAccount('4101', 'Penjualan', 'income', 'credit');
        $this->makeBalancedPosting($this->makeStockEntry(), $cash, $sales, 100);

        $this->assertSame('70.0000', $this->row($this->snapshot(), $cash)['difference']);
    }

    public function test_soft_deleted_ledger_rows_are_excluded_and_deleted_accounts_are_flagged(): void {
        $cash  = $this->makeAccount('1101', 'Kas');
        $sales = $this->makeAccount('4101', 'Penjualan', 'income', 'credit');
        $this->makeBalancedPosting($this->makeStockEntry(), $cash, $sales, 100);
        GeneralLedger::query()->delete();
        $sales->delete();

        $rows = $this->snapshot();

        $this->assertSame('0.0000', $this->row($rows, $cash)['sum_debit']);
        $this->assertSame('akun soft-deleted', $this->row($rows, $sales)['note']);
    }

    public function test_command_writes_csv_and_reports_row_count(): void {
        $this->makeAccount('1101', 'Kas');
        $path = tempnam(sys_get_temp_dir(), 'baseline');

        try {
            $this->artisan('finance:snapshot-balances', ['--path' => $path])->assertSuccessful();

            $lines = file($path, FILE_IGNORE_NEW_LINES);
            $this->assertCount(1 + Account::withTrashed()->count(), $lines);
            $this->assertStringStartsWith('account_id,account_number', $lines[0]);
        } finally {
            @unlink($path);
        }
    }
}
