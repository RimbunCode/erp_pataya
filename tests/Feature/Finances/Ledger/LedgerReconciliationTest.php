<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Finances\Account;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\JournalBackfillService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Ledger\LedgerReconciliationService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 7.3/7.4 (Requirement 10): `finance:reconcile-ledger` mendeteksi pelanggaran invarian ledger
 * dan terjadwal harian. Pelanggaran dibuat lewat query builder mentah (melewati guard model), seperti kerusakan data
 * nyata.
 */
class LedgerReconciliationTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
    }

    private function postedJournal(float $amount = 100): Journal {
        return app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 09:00:00', 'UTC'),
            [
                new JournalLineDraft($this->cash->id, $amount, 0, againstAccountId: $this->revenue->id),
                new JournalLineDraft($this->revenue->id, 0, $amount, againstAccountId: $this->cash->id),
            ],
            $this->branch,
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function reconcile(bool $ignoreUnjournaled = false): array {
        return app(LedgerReconciliationService::class)->run(20, $ignoreUnjournaled);
    }

    public function test_healthy_ledger_passes_and_command_exits_successfully(): void {
        $this->postedJournal();

        $report = $this->reconcile();

        $this->assertFalse($report['failed']);
        foreach ($report['violations'] as $violation) {
            $this->assertSame(0, $violation['count']);
        }
        $this->artisan('finance:reconcile-ledger')->assertExitCode(0);
    }

    public function test_unbalanced_non_legacy_journal_is_a_violation(): void {
        $journal = $this->postedJournal();
        // Rusak hanya sisi debit baris dan total jurnal tetap konsisten, agar hanya pemeriksaan (a) yang terpicu.
        DB::table('general_ledgers')->where('journal_id', $journal->id)->where('line_no', 1)->update(['debit' => 150]);
        DB::table('journals')->where('id', $journal->id)->update(['total_debit' => 150]);

        $report = $this->reconcile();

        $this->assertTrue($report['failed']);
        $this->assertSame(1, $report['violations']['a_unbalanced_journals']['count']);
        $this->assertSame($journal->id, $report['violations']['a_unbalanced_journals']['samples'][0]['id']);
        $this->assertSame(0, $report['violations']['b_total_mismatch']['count']);
        $this->artisan('finance:reconcile-ledger')->assertExitCode(1);
    }

    public function test_journal_total_that_differs_from_the_sum_of_lines_is_a_violation(): void {
        $journal = $this->postedJournal();
        DB::table('journals')->where('id', $journal->id)->update(['total_debit' => 999, 'total_credit' => 999]);

        $report = $this->reconcile();

        $this->assertSame(1, $report['violations']['b_total_mismatch']['count']);
        $this->assertSame(0, $report['violations']['a_unbalanced_journals']['count']);
        $this->assertTrue($report['failed']);
    }

    public function test_active_line_without_journal_is_a_violation_unless_ignored(): void {
        $this->makeLedger($this->branch, $this->cash, $this->revenue, 40, 0);

        $strict = $this->reconcile();
        $this->assertSame(1, $strict['violations']['c_lines_without_journal']['count']);
        $this->assertTrue($strict['failed']);
        $this->artisan('finance:reconcile-ledger')->assertExitCode(1);

        $ignored = $this->reconcile(ignoreUnjournaled: true);
        $this->assertSame(0, $ignored['violations']['c_lines_without_journal']['count']);
        $this->assertSame(1, $ignored['info']['lines_without_journal_ignored']);
        $this->assertFalse($ignored['failed']);
        $this->artisan('finance:reconcile-ledger', ['--ignore-unjournaled' => true])->assertExitCode(0);
    }

    public function test_soft_deleted_line_without_journal_is_also_a_violation_because_not_null_covers_every_row(): void {
        $line = $this->makeLedger($this->branch, $this->cash, $this->revenue, 40, 0);
        DB::table('general_ledgers')->where('id', $line->id)->update(['deleted_at' => now()]);

        $this->assertSame(1, $this->reconcile()['violations']['c_lines_without_journal']['count']);
    }

    public function test_posted_journal_without_active_lines_is_a_violation(): void {
        $journal = $this->postedJournal();
        DB::table('general_ledgers')->where('journal_id', $journal->id)->update(['deleted_at' => now()]);

        $report = $this->reconcile();

        $this->assertSame(1, $report['violations']['d_posted_without_lines']['count']);
        $this->assertTrue($report['failed']);
    }

    public function test_voided_journal_with_soft_deleted_lines_is_healthy_information_only(): void {
        $journal = $this->postedJournal();
        DB::table('general_ledgers')->where('journal_id', $journal->id)->update(['deleted_at' => now()]);
        DB::table('journals')->where('id', $journal->id)->update(['status' => 'voided']);

        $report = $this->reconcile();

        $this->assertFalse($report['failed']);
        $this->assertSame(1, $report['info']['voided_journals']);
    }

    public function test_legacy_unbalanced_journals_are_information_not_failure(): void {
        $doc = ['App\\Models\\Finances\\SalesInvoice', (string) Str::ulid()];
        $this->makeLedger($doc, $this->cash, $this->revenue, 100, 0, CarbonImmutable::parse('2026-03-10 03:00:00', 'UTC'));
        $this->makeLedger($doc, $this->revenue, $this->cash, 0, 60, CarbonImmutable::parse('2026-03-10 03:00:00', 'UTC'));
        app(JournalBackfillService::class)->run();

        $report = $this->reconcile();

        $this->assertSame(1, $report['info']['legacy_unbalanced_journals']);
        $this->assertSame(0, $report['violations']['a_unbalanced_journals']['count'], 'Jurnal legacy tak seimbang dikecualikan dari (a).');
        $this->assertSame(0, $report['violations']['b_total_mismatch']['count']);
        $this->assertFalse($report['failed']);
        $this->artisan('finance:reconcile-ledger')->assertExitCode(0);
    }

    public function test_reconcile_is_read_only(): void {
        $journal = $this->postedJournal();
        DB::table('journals')->where('id', $journal->id)->update(['total_debit' => 999]);
        $before = [DB::table('journals')->get()->toArray(), DB::table('general_ledgers')->get()->toArray()];

        $this->reconcile();

        $this->assertEquals($before, [DB::table('journals')->get()->toArray(), DB::table('general_ledgers')->get()->toArray()]);
    }

    public function test_command_is_scheduled_daily(): void {
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($event) => str_contains((string) $event->command, 'finance:reconcile-ledger'));

        $this->assertCount(1, $events);
        $this->assertSame('0 3 * * *', $events->first()->expression);
        $this->assertStringContainsString('--ignore-unjournaled', (string) $events->first()->command, 'Rilis 1: dicabut setelah backfill (Q-P1-11).');
        $this->assertTrue($events->first()->withoutOverlapping);
    }

    public function test_backfilled_ledger_reconciles_cleanly(): void {
        $doc = ['App\\Models\\Finances\\SalesInvoice', (string) Str::ulid()];
        $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, CarbonImmutable::parse('2026-03-10 03:00:00', 'UTC'));
        $this->assertTrue($this->reconcile()['failed'], 'Sebelum backfill baris tanpa journal_id dilaporkan.');

        app(JournalBackfillService::class)->run();

        $report = $this->reconcile();
        $this->assertFalse($report['failed']);
        $this->assertSame(2, GeneralLedger::whereNotNull('journal_id')->count());
    }
}
