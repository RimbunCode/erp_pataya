<?php

namespace Tests\Feature\Finances\Ledger;

use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\JournalAlreadyReversedException;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 4.6 (P-4): reversal bersih, tertaut dua arah, ditolak untuk jurnal yang sudah dibalik, jurnal
 * pembalik, void, legacy tak seimbang, dan periode tertutup. Izin `reverse` ditegakkan di controller (Task 10.1).
 */
class JournalReversalServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private JournalReversalService $reversal;
    private JournalService $journals;
    private Account $cash;
    private Account $revenue;
    private Account $tax;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash     = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue  = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $this->tax      = $this->makeAccount('2100', 'Utang Pajak', 'liability', 'credit');
        $this->journals = app(JournalService::class);
        $this->reversal = app(JournalReversalService::class);
    }

    private function postTwoLines(?string $key = 'doc:1:default', string $date = '2026-11-04 09:00:00'): Journal {
        return $this->journals->post(new JournalDraft(
            CarbonImmutable::parse($date),
            [
                new JournalLineDraft($this->cash->id, 150000.25, 0, party: $this->branch, againstAccountId: $this->revenue->id),
                new JournalLineDraft($this->revenue->id, 0, 150000.25, againstAccountId: $this->cash->id),
            ],
            $this->branch,
            $key,
            $this->branch->id,
            'Penjualan',
        ));
    }

    /**
     * @return array<string, float>
     */
    private function netByAccount(Journal ...$journals): array {
        $net = [];
        foreach (GeneralLedger::query()->whereIn('journal_id', collect($journals)->pluck('id'))->get() as $line) {
            $net[$line->account_id] = round(($net[$line->account_id] ?? 0.0) + $line->debit - $line->credit, 4);
        }

        return $net;
    }

    public function test_p4_reversal_swaps_sides_links_both_ways_and_nets_to_zero_per_account(): void {
        $original = $this->postTwoLines();
        $reversal = $this->reversal->reverse($original, CarbonImmutable::parse('2026-11-05 08:00:00'), 'Salah input');

        $original->refresh();
        $this->assertSame('reversed', $original->status);
        $this->assertSame($reversal->id, $original->reversed_by_journal_id);

        $this->assertSame('posted', $reversal->status);
        $this->assertSame($original->id, $reversal->reverses_journal_id);
        $this->assertSame('Salah input', $reversal->reversal_reason);
        $this->assertSame('doc:1:default:reversal', $reversal->posting_key);
        $this->assertSame($original->source_type, $reversal->source_type);
        $this->assertSame($original->source_id, $reversal->source_id);
        $this->assertSame($original->branch_id, $reversal->branch_id);
        $this->assertSame('150000.2500', $reversal->total_debit);
        $this->assertSame('2026-11-05', $reversal->transaction_date->toDateString());
        $this->assertSame(__('finances/journal.reversal_prefix') . 'Penjualan', $reversal->description);

        $lines = $reversal->lines()->get();
        $this->assertSame([$this->cash->id, $this->revenue->id], $lines->pluck('account_id')->all());
        $this->assertSame([0.0, 150000.25], $lines->pluck('debit')->all());
        $this->assertSame([150000.25, 0.0], $lines->pluck('credit')->all());
        $this->assertSame([$this->revenue->id, $this->cash->id], $lines->pluck('against_account_id')->all());
        $this->assertSame($this->branch->id, $lines[0]->partyable_id, 'Pihak baris asal disalin.');
        $this->assertSame($this->branch::class, $lines[0]->referenceable_type);

        $this->assertSame([$this->cash->id => 0.0, $this->revenue->id => 0.0], $this->netByAccount($original, $reversal));
    }

    public function test_reversal_of_a_three_line_journal_nets_to_zero(): void {
        $original = $this->journals->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 09:00:00'),
            [
                new JournalLineDraft($this->cash->id, 111000, 0),
                new JournalLineDraft($this->revenue->id, 0, 100000),
                new JournalLineDraft($this->tax->id, 0, 11000),
            ],
        ));

        $reversal = $this->reversal->reverse($original);

        $this->assertSame("journal:{$original->id}:reversal", $reversal->posting_key, 'Tanpa posting_key asal, kunci memakai id jurnal.');
        $this->assertSame([$this->cash->id => 0.0, $this->revenue->id => 0.0, $this->tax->id => 0.0], $this->netByAccount($original, $reversal));
        $this->assertNull($reversal->source_type);
        $this->assertCount(3, $reversal->lines()->get());
    }

    public function test_reversal_date_defaults_to_today(): void {
        $reversal = $this->reversal->reverse($this->postTwoLines());

        $this->assertSame(now()->toDateString(), $reversal->transaction_date->toDateString());
    }

    public function test_p4_second_reversal_is_rejected(): void {
        $original = $this->postTwoLines();
        $this->reversal->reverse($original);

        $this->expectException(JournalAlreadyReversedException::class);
        $this->reversal->reverse($original->refresh());
    }

    public function test_a_reversal_journal_cannot_be_reversed(): void {
        $reversal = $this->reversal->reverse($this->postTwoLines());

        $this->expectException(InvalidJournalException::class);
        $this->reversal->reverse($reversal);
    }

    public function test_voided_journal_is_rejected(): void {
        $original = $this->postTwoLines();
        Journal::query()->whereKey($original->id)->update(['status' => 'voided']);

        $this->expectException(JournalAlreadyReversedException::class);
        $this->reversal->reverse($original->refresh());
    }

    public function test_unbalanced_legacy_journal_is_not_reversible(): void {
        $original = $this->postTwoLines();
        Journal::query()->whereKey($original->id)->update(['legacy_origin' => true, 'legacy_unbalanced' => true]);

        try {
            $this->reversal->reverse($original->refresh());
            $this->fail('Jurnal legacy tak seimbang harus ditolak.');
        } catch (InvalidJournalException $e) {
            $this->assertStringContainsString('manual', $e->getMessage());
        }

        $this->assertSame(1, Journal::count());
    }

    public function test_journal_without_active_lines_is_rejected(): void {
        $original = $this->postTwoLines();
        GeneralLedger::query()->where('journal_id', $original->id)->update(['deleted_at' => now()]);

        $this->expectException(InvalidJournalException::class);
        $this->reversal->reverse($original->refresh());
    }

    public function test_reversal_into_a_closed_period_is_rejected_when_enforcement_is_on_and_leaves_the_original_untouched(): void {
        app(FiscalPeriodService::class)->generateYear(2026);
        $original = $this->postTwoLines();
        app(FiscalPeriodService::class)->close(app(FiscalPeriodService::class)->resolve(CarbonImmutable::parse('2026-12-10')));
        FinanceSetting::current();
        DB::table('finance_settings')->update(['enforce_fiscal_period' => true]);

        try {
            $this->reversal->reverse($original, CarbonImmutable::parse('2026-12-10'));
            $this->fail('Periode tertutup harus ditolak.');
        } catch (ClosedPeriodException) {
            $this->addToAssertionCount(1);
        }

        $original->refresh();
        $this->assertSame('posted', $original->status);
        $this->assertNull($original->reversed_by_journal_id);
        $this->assertSame(1, Journal::count());

        // Tanggal pada periode terbuka berhasil.
        $reversal = $this->reversal->reverse($original, CarbonImmutable::parse('2026-11-20'));
        $this->assertSame($original->id, $reversal->reverses_journal_id);
    }

    public function test_reversal_is_recorded_in_the_audit_log_event_with_reason(): void {
        Event::fake([AuditableModelSaved::class]);
        $original = $this->postTwoLines();

        $reversal = $this->reversal->reverse($original, null, 'Koreksi');

        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $event) => $event->action === 'reversed'
            && $event->model->is($original)
            && $event->dataAfter['reversed_by_journal_id'] === $reversal->id
            && $event->dataAfter['reason'] === 'Koreksi');
    }

    public function test_reversal_normalizes_a_non_utc_date_to_utc_and_keeps_period_consistent(): void {
        app(FiscalPeriodService::class)->generateYear(2026);
        $original = $this->postTwoLines();

        // 00.30 WIB tanggal 1 Desember = 17.30 UTC tanggal 30 November; periode = Desember (bulan WIB).
        $reversal = $this->reversal->reverse($original, CarbonImmutable::parse('2026-12-01 00:30:00', 'Asia/Jakarta'));

        $this->assertSame('2026-11-30 17:30:00', (string) DB::table('journals')->where('id', $reversal->id)->value('transaction_date'));
        $this->assertSame('2026-12', FiscalPeriod::find($reversal->fiscal_period_id)->name);
        $this->assertSame('2026-11-30 17:30:00', (string) DB::table('general_ledgers')->where('journal_id', $reversal->id)->value('transaction_date'));
    }
}
