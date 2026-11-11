<?php

namespace Tests\Feature\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 10.1 (Requirement 11.1-11.2, 14.1): `JournalController` index, show, dan reverse.
 */
class JournalControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;
    private Journal $journal;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');

        $this->journal = app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 10:30:00'),
            [
                new JournalLineDraft($this->cash->id, 150000.5, 0, againstAccountId: $this->revenue->id),
                new JournalLineDraft($this->revenue->id, 0, 150000.5, againstAccountId: $this->cash->id),
            ],
            $this->branch,
            'test:journal:default',
            $this->branch->id,
            'Penjualan tunai',
        ));
    }

    /**
     * @param  list<string>  $permissions  izin Journal yang diberikan
     * @return array<string, mixed>
     */
    private function permissionSession(array $permissions): array {
        $flags = array_fill_keys($permissions, true);

        return [
            'permissions' => [
                Journal::class => [0 => [['model' => Journal::class, 'level' => 0, 'only_creator' => false, 'permissions' => $flags]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function actingWith(array $permissions): static {
        return $this->withSession($this->permissionSession($permissions))->withCookie('lang', 'en')->actingAs($this->user);
    }

    public function test_index_requires_select_permission(): void {
        $this->actingWith(['read'])->get(route('journals.index'))->assertForbidden();
        $this->actingWith(['select'])->get(route('journals.index'))->assertOk()->assertInertia(fn ($page) => $page->component('Finances/Journals/Index'));
    }

    public function test_journal_columns_expose_source_and_period_relations(): void {
        $columns = collect(Journal::computeColumnsFlat(true))->keyBy('name');

        foreach (['code', 'transaction_date', 'source', 'status', 'total_debit', 'total_credit', 'fiscal_period'] as $name) {
            $this->assertTrue($columns->has($name), "Kolom {$name} tidak ada di daftar jurnal.");
        }
        $this->assertSame('morph', $columns['source']['typeRelation']);
    }

    public function test_show_requires_read_permission(): void {
        $this->actingWith(['select'])->get(route('journals.show', $this->journal))->assertForbidden();
    }

    public function test_show_returns_lines_and_server_computed_totals(): void {
        $this->actingWith(['select', 'read'])->get(route('journals.show', $this->journal))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/Journals/Show')
                ->where('journal.id', $this->journal->id)
                ->where('journal.code', $this->journal->code)
                ->has('lines', 2)
                ->where('lines.0.account.account_number', '1100')
                ->where('lines.0.debit', 150000.5)
                ->where('totals.debit', '150000.50')
                ->where('totals.credit', '150000.50')
                ->where('totals.balanced', true)
                ->where('minorUnit', 2)
                ->where('canReverse', false));
    }

    public function test_can_reverse_requires_permission_and_reversible_state(): void {
        $this->actingWith(['select', 'read', 'reverse'])->get(route('journals.show', $this->journal))
            ->assertInertia(fn ($page) => $page->where('canReverse', true));

        $reversal = app(JournalReversalService::class)->reverse($this->journal);

        $this->actingWith(['select', 'read', 'reverse'])->get(route('journals.show', $this->journal->id))
            ->assertInertia(fn ($page) => $page->where('canReverse', false)->where('journal.status', JournalStatus::Reversed->value));
        $this->actingWith(['select', 'read', 'reverse'])->get(route('journals.show', $reversal))
            ->assertInertia(fn ($page) => $page->where('canReverse', false)->where('journal.reverses_journal_id', $this->journal->id));
    }

    public function test_show_voided_journal_lists_soft_deleted_lines(): void {
        GeneralLedger::query()->where('journal_id', $this->journal->id)->update(['deleted_at' => now()]);
        Journal::query()->whereKey($this->journal->id)->update(['status' => JournalStatus::Voided->value]);

        $this->actingWith(['select', 'read', 'reverse'])->get(route('journals.show', $this->journal))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('lines', 2)
                ->where('lines.0.deleted_at', fn ($value) => $value !== null)
                ->where('totals.active_lines', 0)
                ->where('totals.balanced', true)
                ->where('canReverse', false));
    }

    public function test_reverse_is_forbidden_with_only_read_permission(): void {
        $this->actingWith(['select', 'read'])->post(route('journals.reverse', $this->journal), ['reason' => 'x'])->assertForbidden();

        $this->assertSame(JournalStatus::Posted->value, $this->journal->fresh()->status);
        $this->assertSame(1, Journal::count());
    }

    public function test_reverse_creates_reversing_journal_and_redirects_to_it(): void {
        $response = $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), [
            'date'   => now()->toDateString(),
            'reason' => 'Salah akun',
        ]);

        $reversal = Journal::query()->where('reverses_journal_id', $this->journal->id)->firstOrFail();
        $response->assertRedirect(route('journals.show', $reversal));

        $this->assertSame(JournalStatus::Reversed->value, $this->journal->fresh()->status);
        $this->assertSame('Salah akun', $reversal->reversal_reason);
        $this->assertSame($reversal->id, $this->journal->fresh()->reversed_by_journal_id);
    }

    public function test_reverse_requires_a_reason(): void {
        foreach ([[], ['reason' => ''], ['reason' => '   ']] as $payload) {
            $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), $payload)
                ->assertSessionHasErrors('reason');
        }

        $this->assertSame(JournalStatus::Posted->value, $this->journal->fresh()->status);
        $this->assertSame(1, Journal::count());
    }

    public function test_reverse_rejects_date_before_the_original_journal_date(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), [
            'date'   => '2026-11-03',
            'reason' => 'Salah tanggal',
        ])->assertSessionHasErrors('date');

        $this->assertSame(1, Journal::count());
    }

    public function test_reverse_rejects_date_in_the_future(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), [
            'date'   => CarbonImmutable::now()->addDays(2)->toDateString(),
            'reason' => 'Terlalu maju',
        ])->assertSessionHasErrors('date');

        $this->assertSame(1, Journal::count());
    }

    public function test_reverse_accepts_the_original_journal_day(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), [
            'date'   => '2026-11-04',
            'reason' => 'Hari yang sama',
        ])->assertSessionHasNoErrors()->assertRedirect();

        $this->assertSame(JournalStatus::Reversed->value, $this->journal->fresh()->status);
    }

    public function test_show_exposes_reversal_date_bounds_in_company_timezone(): void {
        $timezone = app(FiscalPeriodService::class)->companyTimezone();
        $today    = CarbonImmutable::now($timezone)->toDateString();

        $this->actingWith(['select', 'read', 'reverse'])->get(route('journals.show', $this->journal))
            ->assertInertia(fn ($page) => $page
                ->where('reversal.min_date', CarbonImmutable::parse('2026-11-04 10:30:00')->setTimezone($timezone)->toDateString())
                ->where('reversal.max_date', $today)
                ->where('reversal.default_date', $today));
    }

    public function test_reverse_ignores_attributes_outside_date_and_reason(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), [
            'reason'        => 'ok',
            'status'        => JournalStatus::Voided->value,
            'posting_key'   => 'hacked',
            'total_debit'   => 1,
            'legacy_origin' => true,
        ])->assertRedirect();

        $reversal = Journal::query()->where('reverses_journal_id', $this->journal->id)->firstOrFail();
        $this->assertSame(JournalStatus::Posted->value, $reversal->status);
        $this->assertSame('test:journal:default:reversal', $reversal->posting_key);
        $this->assertSame('150000.5000', $reversal->total_debit);
        $this->assertFalse($reversal->legacy_origin);
    }

    public function test_reverse_twice_returns_validation_error_not_server_error(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['reason' => 'a'])->assertRedirect();

        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['reason' => 'b'])
            ->assertSessionHasErrors('reverse');

        $this->assertSame(1, Journal::query()->where('reverses_journal_id', $this->journal->id)->count());
    }

    public function test_reverse_into_closed_period_with_enforcement_returns_date_error(): void {
        $period = app(FiscalPeriodService::class)->generateYear(2026)->periods()->where('name', '2026-12')->firstOrFail();
        app(FiscalPeriodService::class)->close($period);
        app(SettingsService::class)->update(FinanceSetting::class, ['enforce_fiscal_period' => true]);

        CarbonImmutable::setTestNow('2026-12-20 03:00:00');

        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['date' => '2026-12-15', 'reason' => 'x'])
            ->assertSessionHasErrors('date');

        $this->assertSame(JournalStatus::Posted->value, $this->journal->fresh()->status);
        $this->assertSame(1, Journal::count());
    }

    public function test_reverse_date_is_read_in_the_company_timezone(): void {
        CarbonImmutable::setTestNow('2026-12-20 03:00:00');
        app(FiscalPeriodService::class)->generateYear(2026);

        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['date' => '2026-12-01', 'reason' => 'x'])->assertRedirect();

        $reversal = Journal::query()->where('reverses_journal_id', $this->journal->id)->firstOrFail();
        $this->assertSame('2026-12-01', app(FiscalPeriodService::class)->businessDay($reversal->transaction_date));
        $this->assertSame('2026-12', $reversal->fiscalPeriod->name);
    }

    protected function tearDown(): void {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_reverse_validates_input(): void {
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['date' => 'bukan-tanggal'])
            ->assertSessionHasErrors('date');
        $this->actingWith(['select', 'read', 'reverse'])->post(route('journals.reverse', $this->journal), ['reason' => str_repeat('a', 1001)])
            ->assertSessionHasErrors('reason');

        $this->assertSame(JournalStatus::Posted->value, $this->journal->fresh()->status);
    }
}
