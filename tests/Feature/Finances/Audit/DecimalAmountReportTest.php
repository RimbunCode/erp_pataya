<?php

namespace Tests\Feature\Finances\Audit;

use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Audit\AmountColumns;
use App\Services\Finances\Audit\BalanceSnapshotService;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 8.2 (Requirement 13.4): setelah `debit`/`credit` menjadi `decimal(20,4)`, MySQL mengembalikan
 * nominal dan hasil `SUM` sebagai string. Laporan audit/snapshot harus tetap menghasilkan angka yang sama (float
 * 4 desimal) dan cast model `GeneralLedger` tetap `float` sehingga serialisasi ke frontend tidak berubah.
 *
 * SQLite tidak pernah mengembalikan string desimal, jadi perilaku string diuji langsung pada `AmountColumns`
 * dan pada nilai 4 desimal yang melewati seluruh jalur laporan.
 */
class DecimalAmountReportTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class]);
        $this->cash  = $this->makeAccount('1101', 'Kas', 'asset', 'debit');
        $this->sales = $this->makeAccount('4101', 'Penjualan', 'income', 'credit');
    }

    public function test_amount_columns_normalizes_decimal_strings_to_floats(): void {
        $row = AmountColumns::normalize([
            'id'         => 'x',
            'debit'      => '1000.1234',
            'credit'     => '0.0000',
            'sum_debit'  => '3580246791.3000',
            'sum_credit' => 12,
            'diff'       => '0.0050',
            'untouched'  => '12.5000',
            'null_value' => null,
        ]);

        $this->assertSame(1000.1234, $row['debit']);
        $this->assertSame(0.0, $row['credit']);
        $this->assertSame(3580246791.3, $row['sum_debit']);
        $this->assertSame(12.0, $row['sum_credit']);
        $this->assertSame(0.005, $row['diff']);
        $this->assertSame('12.5000', $row['untouched'], 'Kolom non-nominal tidak boleh berubah.');
        $this->assertNull($row['null_value']);
    }

    public function test_amount_columns_leaves_missing_and_non_numeric_values_alone(): void {
        $this->assertSame(['id' => 'x'], AmountColumns::normalize(['id' => 'x']));
        $this->assertSame(['debit' => 'abc'], AmountColumns::normalize(['debit' => 'abc']));
    }

    public function test_general_ledger_amounts_stay_floats_with_four_decimals(): void {
        $entry = $this->makeStockEntry();
        $line  = $this->makeLedger($entry, $this->cash, $this->sales, 1234.5678, 0);

        $fresh = GeneralLedger::query()->findOrFail($line->id);

        $this->assertIsFloat($fresh->debit);
        $this->assertIsFloat($fresh->credit);
        $this->assertSame(1234.5678, $fresh->debit);
        $this->assertSame(1234.5678, $fresh->toArray()['debit']);
    }

    public function test_audit_totals_and_samples_report_numbers_for_four_decimal_values(): void {
        $entry = $this->makeStockEntry();
        // Tidak seimbang dan 4 desimal: selisih 0.0001 di atas toleransi default 0.005? Tidak; pakai selisih jelas.
        $this->makeLedger($entry, $this->cash, $this->sales, 100.1234, 0);
        $this->makeLedger($entry, $this->sales, $this->cash, 0, 99.0001);

        $report = (new GeneralLedgerAuditor)->run(['limit' => 5]);

        $this->assertSame(100.1234, $report->totals['sum_debit']);
        $this->assertSame(99.0001, $report->totals['sum_credit']);
        $this->assertSame(1.1233, $report->totals['diff']);

        $sample = $report->sections['unbalanced_groups']['samples'][0];
        $this->assertSame(100.1234, $sample['sum_debit']);
        $this->assertSame(99.0001, $sample['sum_credit']);
        $this->assertSame(1.1233, $sample['diff']);
        $this->assertSame(1.1233, $report->sections['unbalanced_groups']['total_diff']);
    }

    public function test_zero_or_negative_samples_report_float_amounts(): void {
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $this->cash, $this->sales, 0, 0);

        $report = (new GeneralLedgerAuditor)->run(['limit' => 5]);

        $sample = $report->sections['zero_or_negative']['samples'][0];
        $this->assertSame(0.0, $sample['debit']);
        $this->assertSame(0.0, $sample['credit']);
    }

    public function test_balance_snapshot_formats_four_decimal_sums(): void {
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $this->cash, $this->sales, 100.1234, 0);
        $this->makeLedger($entry, $this->sales, $this->cash, 0, 100.1234);

        $handle = fopen('php://memory', 'w+');
        (new BalanceSnapshotService)->write($handle);
        rewind($handle);
        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = $row;
        }
        fclose($handle);

        $header = array_shift($rows);
        $cash   = collect($rows)->first(fn (array $row) => $row[1] === '1101');

        $this->assertSame(BalanceSnapshotService::HEADER, $header);
        $this->assertSame('100.1234', $cash[array_search('sum_debit', $header, true)]);
        $this->assertSame('0.0000', $cash[array_search('sum_credit', $header, true)]);
        $this->assertSame('100.1234', $cash[array_search('net', $header, true)]);
    }
}
