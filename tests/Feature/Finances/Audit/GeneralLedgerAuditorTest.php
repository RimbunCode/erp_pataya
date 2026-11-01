<?php

namespace Tests\Feature\Finances\Audit;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 0, Task 2.5: satu test per kategori anomali (P-3), data sehat tanpa false positive (P-4),
 * tabel kosong (Req. 1.6), determinisme (P-2), dan read-only (P-1).
 */
class GeneralLedgerAuditorTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class]);
        $this->cash  = $this->makeAccount('1101', 'Kas', 'asset', 'debit');
        $this->sales = $this->makeAccount('4101', 'Penjualan', 'income', 'credit');
    }

    private function audit(array $options = []) {
        return (new GeneralLedgerAuditor)->run($options);
    }

    /**
     * @return array<string, int>
     */
    private function sectionCounts(array $options = []): array {
        return array_map(fn (array $section) => $section['count'], $this->audit($options)->sections);
    }

    public function test_empty_ledger_completes_with_zero_report(): void {
        GeneralLedger::query()->forceDelete();
        $report = $this->audit();

        $this->assertSame(0, $report->totals['rows']);
        $this->assertSame(0, $report->totals['groups']);
        $this->assertSame(0.0, $report->totals['diff']);
        $this->assertSame(array_fill_keys(array_keys($report->sections), 0), $this->sectionCounts());
        $this->assertCount(9, $report->coverage);
    }

    public function test_healthy_postings_report_no_anomaly(): void {
        $first  = $this->makeStockEntry();
        $second = $this->makeStockEntry();
        $this->makeBalancedPosting($first, $this->cash, $this->sales, 150);
        $this->makeBalancedPosting($second, $this->sales, $this->cash, 75.5);

        $report = $this->audit();

        $this->assertSame(array_fill_keys(array_keys($report->sections), 0), $this->sectionCounts());
        $this->assertSame(4, $report->totals['rows']);
        $this->assertSame(2, $report->totals['groups']);
        $this->assertSame(225.5, $report->totals['sum_debit']);
        $this->assertSame(0.0, $report->totals['diff']);
    }

    public function test_detects_unbalanced_group(): void {
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $this->cash, $this->sales, 100, 0, '2026-01-01 10:00:00');
        $this->makeLedger($entry, $this->sales, $this->cash, 0, 60, '2026-01-01 10:00:00');
        $this->makeBalancedPosting($this->makeStockEntry(), $this->cash, $this->sales, 40);

        $section = $this->audit()->sections['unbalanced_groups'];

        $this->assertSame(1, $section['count']);
        $this->assertSame(40.0, $section['total_diff']);
        $this->assertSame($entry->id, $section['samples'][0]['referenceable_id']);
    }

    public function test_floating_point_noise_is_not_reported_as_unbalanced(): void {
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $this->cash, $this->sales, 0.1 + 0.2, 0, '2026-01-01 10:00:00');
        $this->makeLedger($entry, $this->sales, $this->cash, 0, 0.3, '2026-01-01 10:00:00');

        $this->assertSame(0, $this->audit()->sections['unbalanced_groups']['count']);
    }

    public function test_detects_zero_and_negative_rows(): void {
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $this->cash, $this->sales, 0, 0);
        $this->makeLedger($entry, $this->cash, $this->sales, -5, 0);
        $this->makeLedger($entry, $this->cash, $this->sales, 0, 5);

        $this->assertSame(2, $this->audit()->sections['zero_or_negative']['count']);
    }

    public function test_separates_expected_and_unexpected_soft_deletes(): void {
        $canceled = $this->makeStockEntry([FormStatus::APPROVED]);
        $this->makeBalancedPosting($canceled, $this->cash, $this->sales, 100);
        $canceled->update(['status' => [FormStatus::CANCELED]]);

        $approved = $this->makeStockEntry([FormStatus::APPROVED]);
        $this->makeBalancedPosting($approved, $this->cash, $this->sales, 50);
        GeneralLedger::where('referenceable_id', $approved->id)->delete();

        $report = $this->audit();

        $this->assertSame(2, $report->sections['soft_deleted_expected']['count']);
        $this->assertSame(2, $report->sections['soft_deleted_unexpected']['count']);
        $this->assertSame(0, $report->sections['canceled_active_gl']['count']);
        $this->assertSame(4, $report->totals['rows_soft_deleted']);
    }

    public function test_soft_delete_of_missing_document_is_unexpected(): void {
        $this->makeBalancedPosting($this->missingDocument(StockEntry::class), $this->cash, $this->sales, 10);
        GeneralLedger::query()->delete();

        $report = $this->audit();

        $this->assertSame(0, $report->sections['soft_deleted_expected']['count']);
        $this->assertSame(2, $report->sections['soft_deleted_unexpected']['count']);
    }

    public function test_detects_dangling_account(): void {
        $this->makeBalancedPosting($this->makeStockEntry(), $this->cash, $this->sales, 10);
        $this->sales->delete();

        // Satu pasangan: baris 1 merujuk `sales` sebagai lawan, baris 2 sebagai akun utama.
        $this->assertSame(2, $this->audit()->sections['dangling_account']['count']);
    }

    public function test_detects_orphan_reference_and_unknown_type(): void {
        $this->makeBalancedPosting($this->missingDocument(StockEntry::class), $this->cash, $this->sales, 10);
        // Kelas yang sudah tidak ada tidak dapat dibuat lewat model (MorphTo gagal), jadi disisipkan langsung.
        DB::table('general_ledgers')->insert([
            'id'                 => (string) Str::ulid(),
            'code'               => 'GL-RAW-1',
            'referenceable_type' => 'App\\Models\\Gone\\Removed',
            'referenceable_id'   => (string) Str::ulid(),
            'account_id'         => $this->cash->id,
            'against_account_id' => $this->sales->id,
            'debit'              => 5,
            'credit'             => 0,
            'transaction_date'   => now(),
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        $section = $this->audit()->sections['orphan_reference'];

        $this->assertSame(3, $section['count']);
        $this->assertContains('tipe tidak dikenal', array_column($section['samples'], 'note'));
    }

    public function test_detects_canceled_document_with_active_ledger(): void {
        $entry = $this->makeStockEntry([FormStatus::CANCELED]);
        $this->makeBalancedPosting($entry, $this->cash, $this->sales, 20);
        $this->makeBalancedPosting($this->makeStockEntry([FormStatus::APPROVED]), $this->cash, $this->sales, 20);

        $section = $this->audit()->sections['canceled_active_gl'];

        $this->assertSame(1, $section['count']);
        $this->assertSame($entry->id, $section['samples'][0]['referenceable_id']);
    }

    public function test_detects_duplicate_postings(): void {
        $entry = $this->makeStockEntry();
        $date  = '2026-01-01 10:00:00';
        $this->makeBalancedPosting($entry, $this->cash, $this->sales, 100, $date);
        $this->makeBalancedPosting($entry, $this->cash, $this->sales, 100, $date);

        $section = $this->audit()->sections['duplicates'];

        $this->assertSame(2, $section['count']);
        $this->assertSame(2, $section['extra_rows']);
    }

    public function test_limit_option_caps_samples_but_not_counts(): void {
        foreach (range(1, 3) as $i) {
            $this->makeLedger($this->makeStockEntry(), $this->cash, $this->sales, 0, 0);
        }

        $section = $this->audit(['limit' => 2])->sections['zero_or_negative'];

        $this->assertSame(3, $section['count']);
        $this->assertCount(2, $section['samples']);
    }

    public function test_coverage_matrix_lists_every_document_type_and_counts_stock_entries(): void {
        $canceled = $this->makeStockEntry([FormStatus::APPROVED]);
        $this->makeBalancedPosting($canceled, $this->cash, $this->sales, 10);
        $canceled->update(['status' => [FormStatus::CANCELED]]);
        $leaked = $this->makeStockEntry([FormStatus::CANCELED]);
        $this->makeBalancedPosting($leaked, $this->cash, $this->sales, 10);
        $this->makeBalancedPosting($this->makeStockEntry([FormStatus::APPROVED]), $this->cash, $this->sales, 10);

        $coverage = collect($this->audit()->coverage)->keyBy('type');

        $this->assertSame(
            ['sales_invoice', 'purchase_invoice', 'purchase_receipt', 'delivery_note', 'payment_entry', 'stock_entry', 'asset_depreciation_schedule', 'asset_value_adjustment', 'asset'],
            $coverage->keys()->all(),
        );

        $stock = $coverage['stock_entry'];
        $this->assertFalse($stock['tracked']);
        $this->assertNull($stock['posting_not_posted']);
        $this->assertSame(1, $stock['approved']);
        $this->assertSame(2, $stock['canceled']);
        $this->assertSame(3, $stock['with_gl']);
        $this->assertSame(1, $stock['canceled_gl_softdeleted']);
        $this->assertSame(1, $stock['canceled_active_gl']);

        $this->assertSame(0, $coverage['payment_entry']['with_gl']);
        $this->assertFalse($coverage['payment_entry']['tracked']);
        $this->assertTrue($coverage['sales_invoice']['tracked']);
        $this->assertNull($coverage['asset_depreciation_schedule']['approved']);
    }

    public function test_report_is_deterministic(): void {
        $this->makeBalancedPosting($this->makeStockEntry(), $this->cash, $this->sales, 10);
        $this->makeLedger($this->makeStockEntry(), $this->cash, $this->sales, 7, 0, '2026-01-01 10:00:00');

        $first  = $this->audit()->toArray();
        $second = $this->audit()->toArray();
        unset($first['generated_at'], $second['generated_at']);

        $this->assertSame($first, $second);
    }

    public function test_audit_and_snapshot_do_not_change_any_table(): void {
        $this->makeBalancedPosting($this->makeStockEntry(), $this->cash, $this->sales, 10);
        $this->makeLedger($this->makeStockEntry([FormStatus::CANCELED]), $this->cash, $this->sales, 3, 0);

        $counts = fn () => collect(Schema::getTableListing())->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()])->all();
        $before = $counts();

        $path = tempnam(sys_get_temp_dir(), 'audit');
        try {
            $this->artisan('finance:audit-gl')->assertSuccessful();
            $this->artisan('finance:snapshot-balances', ['--path' => $path])->assertSuccessful();
        } finally {
            @unlink($path);
        }

        $this->assertSame($before, $counts());
    }

    public function test_command_writes_json_report_to_given_path(): void {
        $this->makeBalancedPosting($this->makeStockEntry(), $this->cash, $this->sales, 10);
        $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'finance-audit-' . uniqid() . '.json';

        try {
            $this->artisan('finance:audit-gl', ['--json' => $path, '--limit' => 5])->assertSuccessful();

            $decoded = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame(2, $decoded['totals']['rows']);
            $this->assertArrayHasKey('unbalanced_groups', $decoded['sections']);
            $this->assertCount(9, $decoded['coverage']);
        } finally {
            @unlink($path);
        }
    }

    public function test_command_fails_clearly_when_json_path_is_not_writable(): void {
        $blocker = tempnam(sys_get_temp_dir(), 'blocker');

        try {
            $this->artisan('finance:audit-gl', ['--json' => $blocker . DIRECTORY_SEPARATOR . 'out.json'])->assertFailed();
        } finally {
            @unlink($blocker);
        }
    }
}
