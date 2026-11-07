<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\JournalBackfillService;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Ledger\LedgerReconciliationService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 7.1/7.2 (Requirement 9, D-8): backfill GL lama menjadi jurnal legacy. Baris legacy dibuat
 * lewat `GeneralLedger::create` tanpa `journal_id`, persis seperti data sebelum Fase 1.
 */
class JournalBackfillTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function document(): array {
        return ['App\\Models\\Finances\\SalesInvoice', (string) Str::ulid()];
    }

    private function at(string $utc): CarbonImmutable {
        return CarbonImmutable::parse($utc, 'UTC');
    }

    private function backfill(bool $dryRun = false, int $chunk = 1000, ?int $limit = null): array {
        return app(JournalBackfillService::class)->run($dryRun, $chunk, $limit);
    }

    /**
     * @return Collection<int, Journal>
     */
    private function legacyJournals(): Collection {
        return Journal::query()->withoutGlobalScopes()->orderBy('transaction_date')->get();
    }

    public function test_backfill_groups_a_balanced_document_into_one_legacy_journal_and_preserves_every_account_total(): void {
        $doc = $this->document();
        $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        $other = $this->document();
        $this->makeBalancedPosting($other, $this->cash, $this->revenue, 70, $this->at('2026-03-11 03:00:00'));

        $report = $this->backfill();

        $this->assertSame(2, $report['journals']);
        $this->assertSame(4, $report['lines']);
        $this->assertSame(0, $report['unbalanced_journals']);
        $this->assertSame([], $report['failures']);
        $this->assertSame([], $report['mismatched_accounts'], 'Σdebit/Σkredit/jumlah baris per akun tidak berubah (Requirement 9.5).');
        $this->assertSame($report['before']['accounts'], $report['after']['accounts']);
        $this->assertSame(['active' => 0, 'soft_deleted' => 0], $report['rows_without_journal']);

        $journal = $this->legacyJournals()->first();
        $this->assertTrue($journal->legacy_origin);
        $this->assertFalse($journal->legacy_unbalanced);
        $this->assertSame('posted', $journal->status);
        $this->assertSame($doc[0], $journal->source_type);
        $this->assertSame($doc[1], $journal->source_id);
        $this->assertEqualsWithDelta(500, $journal->total_debit, 0.0001);
        $this->assertEqualsWithDelta(500, $journal->total_credit, 0.0001);
        $this->assertSame([1, 2], $journal->lines()->orderBy('line_no')->pluck('line_no')->all());
        $this->assertNotNull($journal->code);
        $this->assertNotNull($journal->fiscal_period_id, 'Periode fiskal dibuat untuk tahun transaksi (Requirement 6.8).');
    }

    public function test_backfill_does_not_change_line_values_dates_or_codes(): void {
        $doc    = $this->document();
        $lines  = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 123.4567, $this->at('2026-03-10 03:00:00'));
        $before = GeneralLedger::query()->orderBy('id')->get(['id', 'debit', 'credit', 'account_id', 'transaction_date', 'code', 'description'])->toArray();

        $this->backfill();

        $after = GeneralLedger::query()->orderBy('id')->get(['id', 'debit', 'credit', 'account_id', 'transaction_date', 'code', 'description'])->toArray();
        $this->assertSame($before, $after);
        $this->assertCount(2, $lines);
    }

    public function test_second_run_is_idempotent(): void {
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));

        $first  = $this->backfill();
        $second = $this->backfill();

        $this->assertSame(1, $first['journals']);
        $this->assertSame(0, $second['journals']);
        $this->assertSame(0, $second['documents']);
        $this->assertSame(1, Journal::query()->withoutGlobalScopes()->count());
    }

    public function test_unbalanced_group_is_flagged_without_correcting_values(): void {
        $doc = $this->document();
        $this->makeLedger($doc, $this->cash, $this->revenue, 100, 0, $this->at('2026-03-10 03:00:00'));
        $this->makeLedger($doc, $this->revenue, $this->cash, 0, 60, $this->at('2026-03-10 03:00:00'));

        $report = $this->backfill();

        $journal = $this->legacyJournals()->sole();
        $this->assertSame(1, $report['unbalanced_journals']);
        $this->assertTrue($journal->legacy_unbalanced);
        $this->assertEqualsWithDelta(100, $journal->total_debit, 0.0001);
        $this->assertEqualsWithDelta(60, $journal->total_credit, 0.0001);
        $this->assertEqualsWithDelta(100, GeneralLedger::where('journal_id', $journal->id)->sum('debit'), 0.0001, 'Nilai tidak dikoreksi (Requirement 9.3).');
    }

    public function test_soft_deleted_rows_become_a_voided_legacy_journal_so_every_row_has_a_journal_id(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        DB::table('general_ledgers')->whereIn('id', [$debit->id, $credit->id])->update(['deleted_at' => now()]);
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 50, $this->at('2026-03-10 03:00:00'));

        $report = $this->backfill();

        $this->assertSame(2, $report['soft_deleted_rows'], 'Jumlah baris soft-deleted sebelum backfill.');
        $this->assertSame(2, $report['journals']);
        $this->assertSame(1, $report['voided_journals']);
        $this->assertSame(['active' => 0, 'soft_deleted' => 0], $report['rows_without_journal']);
        $this->assertSame([], $report['mismatched_accounts'], 'Σ baris aktif tidak berubah; baris soft-deleted tidak ikut Σ.');

        $voided = Journal::query()->withoutGlobalScopes()->where('source_id', $doc[1])->sole();
        $this->assertSame('voided', $voided->status);
        $this->assertTrue($voided->legacy_origin);
        $this->assertFalse($voided->legacy_unbalanced);
        $this->assertEqualsWithDelta(500, $voided->total_debit, 0.0001);
        $this->assertSame($voided->id, DB::table('general_ledgers')->where('id', $debit->id)->value('journal_id'));
        $this->assertNotNull(DB::table('general_ledgers')->where('id', $debit->id)->value('deleted_at'), 'Baris tetap soft-deleted.');
        $this->assertSame(0, DB::table('general_ledgers')->whereNull('journal_id')->count(), 'Pengaman NOT NULL (Task 9.1) dapat lolos.');
    }

    public function test_deleted_and_active_rows_of_the_same_document_and_day_are_kept_in_separate_journals(): void {
        $doc                    = $this->document();
        [$oldDebit, $oldCredit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        DB::table('general_ledgers')->whereIn('id', [$oldDebit->id, $oldCredit->id])->update(['deleted_at' => now()]);
        $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 520, $this->at('2026-03-10 04:00:00'));

        $report = $this->backfill();

        $this->assertSame(2, $report['journals']);
        $journals = Journal::query()->withoutGlobalScopes()->where('source_id', $doc[1])->orderBy('status')->get();
        $this->assertSame(['posted', 'voided'], $journals->pluck('status')->all());
        $this->assertEqualsWithDelta(520, $journals[0]->total_debit, 0.0001, 'Jurnal aktif hanya memuat baris aktif.');
        $this->assertEqualsWithDelta(500, $journals[1]->total_debit, 0.0001);
        $this->assertSame(0, $report['unbalanced_journals']);
        $this->assertSame([], $report['mismatched_accounts']);
    }

    public function test_second_run_after_voided_backfill_is_idempotent_and_dry_run_counts_voided_groups(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        DB::table('general_ledgers')->whereIn('id', [$debit->id, $credit->id])->update(['deleted_at' => now()]);

        $dry = $this->backfill(dryRun: true);
        $this->assertSame(1, $dry['journals']);
        $this->assertSame(1, $dry['voided_journals']);
        $this->assertSame(0, Journal::query()->withoutGlobalScopes()->count());

        $this->backfill();
        $second = $this->backfill();

        $this->assertSame(0, $second['journals']);
        $this->assertSame(1, Journal::query()->withoutGlobalScopes()->count());
    }

    /**
     * Memanggil `backfillGroup` dengan daftar id yang sudah basi (dokumen dibatalkan setelah pengelompokan).
     *
     * @param  list<string>  $ids
     */
    private function backfillStaleGroup(array $doc, array $ids): mixed {
        [$currency, $minorUnit] = app(JournalService::class)->baseCurrency();
        $method                 = new \ReflectionMethod(JournalBackfillService::class, 'backfillGroup');

        return DB::transaction(fn () => $method->invoke(app(JournalBackfillService::class), $doc[0], $doc[1], $ids, $minorUnit, $currency));
    }

    public function test_group_cancelled_between_grouping_and_backfill_becomes_a_voided_journal_and_reconciles_clean(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        // Pengelompokan (tanpa kunci) melihat baris aktif; hook Submitable lalu men-soft-delete keduanya.
        DB::table('general_ledgers')->whereIn('id', [$debit->id, $credit->id])->update(['deleted_at' => now()]);

        $outcome = $this->backfillStaleGroup($doc, [$debit->id, $credit->id]);

        $this->assertSame(2, $outcome['lines']);
        $journal = Journal::query()->withoutGlobalScopes()->where('source_id', $doc[1])->sole();
        $this->assertSame('voided', $journal->status, 'Status diturunkan dari baris terkunci, bukan dari pengelompokan basi.');
        $this->assertSame($journal->id, DB::table('general_ledgers')->where('id', $debit->id)->value('journal_id'));
        $this->assertFalse(app(LedgerReconciliationService::class)->run()['failed'], 'Reconcile (d) tidak dilanggar.');
    }

    public function test_group_with_mixed_deletion_state_is_rejected_rolled_back_and_regrouped_by_the_next_run(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        DB::table('general_ledgers')->where('id', $debit->id)->update(['deleted_at' => now()]);

        $journalsBefore = Journal::query()->withoutGlobalScopes()->count();

        try {
            $this->backfillStaleGroup($doc, [$debit->id, $credit->id]);
            $this->fail('Grup campuran harus ditolak.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('campuran', $e->getMessage());
        }

        $this->assertSame($journalsBefore, Journal::query()->withoutGlobalScopes()->count(), 'Tidak ada jurnal setengah jadi.');
        $this->assertSame(2, DB::table('general_ledgers')->whereNull('journal_id')->count());
        $this->assertSame(2, DB::table('general_ledgers')->whereNull('line_no')->count(), 'line_no tidak terisi.');

        $report = $this->backfill();

        $this->assertSame([], $report['failures']);
        $this->assertSame(2, $report['journals']);
        $statuses = Journal::query()->withoutGlobalScopes()->where('source_id', $doc[1])->orderBy('status')->pluck('status')->all();
        $this->assertSame(['posted', 'voided'], $statuses);
        $this->assertFalse(app(LedgerReconciliationService::class)->run()['failed']);
    }

    public function test_run_records_a_group_that_turns_mixed_mid_run_as_a_failure_and_the_next_run_regroups_it(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        $fired            = false;

        // Setelah pengelompokan tanpa kunci (SELECT id, transaction_date, deleted_at) dokumen "dibatalkan" sebagian.
        DB::listen(function ($query) use (&$fired, $debit) {
            if (! $fired && str_contains($query->sql, '"transaction_date", "deleted_at"')) {
                $fired = true;
                DB::table('general_ledgers')->where('id', $debit->id)->update(['deleted_at' => now()]);
            }
        });

        $report = $this->backfill();

        $this->assertTrue($fired);
        $this->assertCount(1, $report['failures']);
        $this->assertStringContainsString('campuran', $report['failures'][0]);
        $this->assertSame(0, $report['journals']);
        $this->assertSame(0, Journal::query()->withoutGlobalScopes()->count());

        $second = $this->backfill();

        $this->assertSame([], $second['failures']);
        $this->assertSame(2, $second['journals']);
        $this->assertCount(2, array_unique(DB::table('general_ledgers')->whereIn('id', [$debit->id, $credit->id])->pluck('journal_id')->all()));
    }

    public function test_pair_posted_seconds_apart_stays_one_journal(): void {
        $doc = $this->document();
        $this->makeLedger($doc, $this->cash, $this->revenue, 100, 0, $this->at('2026-03-10 03:00:00'));
        $this->makeLedger($doc, $this->revenue, $this->cash, 0, 100, $this->at('2026-03-10 03:00:02'));

        $report = $this->backfill();

        $this->assertSame(1, $report['journals'], 'N-3: pasangan yang berbeda detik tidak boleh pecah.');
        $this->assertSame(0, $report['unbalanced_journals']);
    }

    public function test_document_posted_on_two_business_days_becomes_two_journals_and_journal_date_is_the_earliest_row(): void {
        $doc = $this->document();
        $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 100, $this->at('2026-03-10 03:00:00'));
        $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 40, $this->at('2026-03-12 03:00:00'));

        $report = $this->backfill();

        $this->assertSame(2, $report['journals']);
        $this->assertSame(0, $report['unbalanced_journals'], 'Tiap hari seimbang sendiri (D-8).');
        $journals = $this->legacyJournals();
        $this->assertSame('2026-03-10 03:00:00', $journals[0]->transaction_date->copy()->utc()->format('Y-m-d H:i:s'));
        $this->assertSame('2026-03-12 03:00:00', $journals[1]->transaction_date->copy()->utc()->format('Y-m-d H:i:s'));
    }

    public function test_business_day_boundary_follows_company_timezone_not_utc_date(): void {
        // Asia/Jakarta = UTC+7. 16:30 UTC (23:30 WIB, tanggal 10) dan 17:30 UTC (00:30 WIB, tanggal 11) beda hari
        // bisnis walau sama-sama tanggal UTC 10; 03:00 dan 16:59 UTC sama-sama hari WIB tanggal 10 (Q-P1-5).
        $split = $this->document();
        $this->makeBalancedPosting($split, $this->cash, $this->revenue, 100, $this->at('2026-03-10 16:30:00'));
        $this->makeBalancedPosting($split, $this->cash, $this->revenue, 100, $this->at('2026-03-10 17:30:00'));
        $same = $this->document();
        $this->makeBalancedPosting($same, $this->cash, $this->revenue, 100, $this->at('2026-03-10 03:00:00'));
        $this->makeBalancedPosting($same, $this->cash, $this->revenue, 100, $this->at('2026-03-10 16:59:00'));

        $this->backfill();

        $this->assertSame(2, Journal::query()->withoutGlobalScopes()->where('source_id', $split[1])->count());
        $this->assertSame(1, Journal::query()->withoutGlobalScopes()->where('source_id', $same[1])->count());
    }

    public function test_dry_run_writes_nothing_and_reports_what_would_happen(): void {
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 70, $this->at('2026-03-11 03:00:00'));

        $report = $this->backfill(dryRun: true);

        $this->assertTrue($report['dry_run']);
        $this->assertSame(2, $report['journals']);
        $this->assertSame(4, $report['lines']);
        $this->assertSame(0, Journal::query()->withoutGlobalScopes()->count());
        $this->assertSame(0, FiscalYear::query()->count(), 'Dry-run tidak membuat tahun fiskal.');
        $this->assertSame(4, DB::table('general_ledgers')->whereNull('journal_id')->count());
        $this->assertSame(2026, $report['years']['from']);
    }

    public function test_limit_stops_early_and_a_later_run_resumes_the_rest(): void {
        for ($i = 1; $i <= 3; $i++) {
            $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 10 * $i, $this->at("2026-03-1{$i} 03:00:00"));
        }

        $first = $this->backfill(limit: 1);
        $this->assertSame(1, $first['journals']);
        $this->assertTrue($first['limit_reached']);
        $this->assertSame(4, $first['rows_without_journal']['active']);

        $second = $this->backfill(chunk: 1);
        $this->assertSame(2, $second['journals']);
        $this->assertFalse($second['limit_reached']);
        $this->assertSame(3, Journal::query()->withoutGlobalScopes()->count());
        $this->assertSame(0, $second['rows_without_journal']['active']);
    }

    public function test_chunk_size_does_not_change_the_result(): void {
        for ($i = 1; $i <= 4; $i++) {
            $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 10 * $i, $this->at("2026-03-1{$i} 03:00:00"));
        }

        $report = $this->backfill(chunk: 1);

        $this->assertSame(4, $report['journals']);
        $this->assertSame(4, $report['documents']);
        $this->assertSame([], $report['mismatched_accounts']);
    }

    public function test_example_rows_are_merged_so_the_not_null_migration_is_not_blocked(): void {
        $doc              = $this->document();
        [$debit, $credit] = $this->makeBalancedPosting($doc, $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        DB::table('general_ledgers')->whereIn('id', [$debit->id, $credit->id])->update(['is_example' => true]);

        $report = $this->backfill();

        $this->assertSame(1, $report['journals']);
        $this->assertSame(0, $report['rows_without_journal']['active']);
        $this->assertTrue((bool) Journal::query()->withoutGlobalScopes()->where('source_id', $doc[1])->value('is_example'));
    }

    public function test_run_creates_the_journal_series_when_missing_but_dry_run_does_not(): void {
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));
        FormatingSeries::query()->where('model', Journal::class)->delete();

        $this->assertSame(1, $this->backfill(dryRun: true)['journals']);
        $this->assertSame(0, FormatingSeries::query()->where('model', Journal::class)->count(), 'Dry-run tidak menulis apa pun.');

        $report = $this->backfill();

        $this->assertSame(1, $report['journals']);
        $this->assertSame([], $report['failures']);
        $this->assertSame(1, FormatingSeries::query()->where('model', Journal::class)->count());
    }

    public function test_command_reports_summary_and_validates_options(): void {
        $this->makeBalancedPosting($this->document(), $this->cash, $this->revenue, 500, $this->at('2026-03-10 03:00:00'));

        $this->artisan('finance:backfill-journals', ['--chunk' => '0'])->assertExitCode(2);
        $this->artisan('finance:backfill-journals', ['--limit' => 'abc'])->assertExitCode(2);
        $this->assertSame(0, Journal::query()->withoutGlobalScopes()->count());

        $this->artisan('finance:backfill-journals', ['--dry-run' => true])->assertExitCode(0);
        $this->assertSame(0, Journal::query()->withoutGlobalScopes()->count());

        $this->artisan('finance:backfill-journals')->assertExitCode(0);
        $this->assertSame(1, Journal::query()->withoutGlobalScopes()->count());

        $this->artisan('finance:backfill-journals')->assertExitCode(0);
        $this->assertSame(1, Journal::query()->withoutGlobalScopes()->count());
    }
}
