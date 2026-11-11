<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Core\Log;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\Journal;
use App\Models\Inventory\StockEntry;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 10.1/10.3 (Requirement 6.7, 11.4-11.5, 14.1-14.2): `FiscalPeriodController` dan hitungan
 * transaksi di periode tak terdefinisi untuk peringatan penegakan.
 */
class FiscalPeriodControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private FiscalPeriodService $periods;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class, StockEntry::class]);
        $this->periods = app(FiscalPeriodService::class);
    }

    /**
     * @param  list<string>  $permissions  izin FiscalPeriod
     * @param  list<string>  $settingPermissions  izin FinanceSetting
     * @return array<string, mixed>
     */
    private function permissionSession(array $permissions, array $settingPermissions = []): array {
        $entry = fn (string $model, array $flags) => [0 => [['model' => $model, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($flags, true)]]];

        return [
            'permissions' => [
                FiscalPeriod::class => $entry(FiscalPeriod::class, $permissions),
                ...($settingPermissions === [] ? [] : [FinanceSetting::class => $entry(FinanceSetting::class, $settingPermissions)]),
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function actingWith(array $permissions, array $settingPermissions = []): static {
        return $this->withSession($this->permissionSession($permissions, $settingPermissions))->withCookie('lang', 'en')->actingAs($this->user);
    }

    private function period(string $name): FiscalPeriod {
        return FiscalPeriod::query()->where('name', $name)->firstOrFail();
    }

    public function test_index_requires_select_permission(): void {
        $this->actingWith(['read'])->get(route('fiscalPeriods.index'))->assertForbidden();
    }

    public function test_index_lists_years_periods_and_flags(): void {
        $this->periods->generateYear(2026);
        $this->periods->close($this->period('2026-01'));

        $this->actingWith(['select', 'close_period'], ['write'])->get(route('fiscalPeriods.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/FiscalPeriods/Index')
                ->has('fiscalYears', 1)
                ->where('fiscalYears.0.name', '2026')
                ->has('fiscalYears.0.periods', 12)
                ->where('fiscalYears.0.periods.0.status', 'closed')
                ->where('fiscalYears.0.periods.1.status', 'open')
                ->where('enforceFiscalPeriod', false)
                ->where('canClose', true)
                ->where('canReopen', false)
                ->where('canGenerate', false)
                ->where('canEnforce', true));
    }

    public function test_show_route_exists_for_relation_links_and_redirects_to_settings_page(): void {
        $this->periods->generateYear(2026);

        $this->actingWith(['select', 'read'])->get(route('fiscalPeriods.show', $this->period('2026-01')))
            ->assertRedirect(route('fiscalPeriods.index'));
    }

    public function test_show_route_requires_read_permission(): void {
        $this->periods->generateYear(2026);

        $this->actingWith(['select'])->get(route('fiscalPeriods.show', $this->period('2026-01')))->assertForbidden();
    }

    public function test_index_without_finance_setting_permission_cannot_enforce(): void {
        $this->actingWith(['select'])->get(route('fiscalPeriods.index'))
            ->assertInertia(fn ($page) => $page->where('canEnforce', false));
    }

    public function test_generate_creates_calendar_year_and_is_idempotent(): void {
        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), ['year' => 2026])->assertRedirect();
        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), ['year' => 2026])->assertRedirect();

        $this->assertSame(1, FiscalYear::query()->where('name', '2026')->count());
        $this->assertSame(12, FiscalPeriod::query()->count());
    }

    public function test_generate_requires_create_permission(): void {
        $this->actingWith(['select', 'close_period'])->post(route('fiscalPeriods.generate'), ['year' => 2026])->assertForbidden();

        $this->assertSame(0, FiscalYear::query()->count());
    }

    public function test_generate_validates_year(): void {
        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), ['year' => 'abc'])->assertSessionHasErrors('year');
        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), ['year' => 3000])->assertSessionHasErrors('year');
        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), [])->assertSessionHasErrors('year');

        $this->assertSame(0, FiscalYear::query()->count());
    }

    public function test_generate_surfaces_non_calendar_year_conflict_as_validation_error(): void {
        $this->periods->createYear('2026', now()->setDate(2026, 4, 1), now()->setDate(2027, 3, 31));

        $this->actingWith(['select', 'create'])->post(route('fiscalPeriods.generate'), ['year' => 2026])->assertSessionHasErrors('year');
    }

    public function test_close_requires_close_period_permission(): void {
        $this->periods->generateYear(2026);

        $this->actingWith(['select', 'write', 'reopen_period'])->put(route('fiscalPeriods.close', $this->period('2026-03')))->assertForbidden();

        $this->assertSame('open', $this->period('2026-03')->status);
    }

    public function test_close_and_reopen_record_status_actor_and_audit_reason(): void {
        $this->periods->generateYear(2026);
        $period = $this->period('2026-03');

        $this->actingWith(['select', 'close_period', 'reopen_period'])
            ->put(route('fiscalPeriods.close', $period), ['reason' => 'Tutup buku Maret'])
            ->assertRedirect();

        $closed = $this->period('2026-03');
        $this->assertSame('closed', $closed->status);
        $this->assertSame($this->user->id, $closed->closed_by_id);
        $this->assertNotNull($closed->closed_at);

        $this->actingWith(['select', 'close_period', 'reopen_period'])
            ->put(route('fiscalPeriods.open', $period), ['reason' => 'Koreksi'])
            ->assertRedirect();

        $reopened = $this->period('2026-03');
        $this->assertSame('open', $reopened->status);
        $this->assertNull($reopened->closed_at);

        $reasons = Log::query()
            ->where('loggable_type', FiscalPeriod::class)
            ->where('loggable_id', $period->id)
            ->get()
            ->map(fn (Log $log) => data_get($log->data_after, 'reason'))
            ->filter()
            ->values()
            ->all();
        $this->assertContains('Tutup buku Maret', $reasons);
        $this->assertContains('Koreksi', $reasons);
    }

    public function test_reopen_requires_reopen_period_permission(): void {
        $this->periods->generateYear(2026);
        $this->periods->close($this->period('2026-03'));

        $this->actingWith(['select', 'close_period'])->put(route('fiscalPeriods.open', $this->period('2026-03')))->assertForbidden();

        $this->assertSame('closed', $this->period('2026-03')->status);
    }

    public function test_status_actions_ignore_attributes_other_than_reason(): void {
        $this->periods->generateYear(2026);
        $period = $this->period('2026-03');

        $this->actingWith(['select', 'close_period'])->put(route('fiscalPeriods.close', $period), [
            'reason'         => 'ok',
            'name'           => 'dibajak',
            'start_date'     => '2000-01-01',
            'closed_by_id'   => 'orang-lain',
            'fiscal_year_id' => 'x',
        ])->assertRedirect();

        $fresh = $this->period('2026-03');
        $this->assertSame('2026-03', $fresh->name);
        $this->assertSame('2026-03-01', $fresh->start_date->toDateString());
        $this->assertSame($this->user->id, $fresh->closed_by_id);
    }

    public function test_enforcement_toggle_requires_finance_setting_write(): void {
        $this->actingWith(['select', 'write'], ['read'])->put(route('fiscalPeriods.enforcement'), ['enforce_fiscal_period' => true])->assertForbidden();
        $this->actingWith(['select', 'write'])->put(route('fiscalPeriods.enforcement'), ['enforce_fiscal_period' => true])->assertForbidden();

        $this->assertFalse((bool) app(SettingsService::class)->getForRead(FinanceSetting::class)->enforce_fiscal_period);
    }

    public function test_enforcement_toggle_updates_only_the_enforcement_setting(): void {
        app(SettingsService::class)->update(FinanceSetting::class, ['tax_invoice_serial_range_start' => 10, 'tax_invoice_serial_range_end' => 99]);

        $this->actingWith(['select'], ['write'])->put(route('fiscalPeriods.enforcement'), ['enforce_fiscal_period' => true])->assertRedirect();

        $setting = app(SettingsService::class)->getForRead(FinanceSetting::class);
        $this->assertTrue((bool) $setting->enforce_fiscal_period);
        $this->assertSame(10, (int) $setting->tax_invoice_serial_range_start, 'Rentang faktur pajak tidak boleh berubah.');
        $this->assertSame(99, (int) $setting->tax_invoice_serial_range_end);

        $this->actingWith(['select'], ['write'])->put(route('fiscalPeriods.enforcement'), ['enforce_fiscal_period' => false])->assertRedirect();
        $this->assertFalse((bool) app(SettingsService::class)->getForRead(FinanceSetting::class)->enforce_fiscal_period);
    }

    public function test_enforcement_toggle_validates_boolean(): void {
        $this->actingWith(['select'], ['write'])->put(route('fiscalPeriods.enforcement'), [])->assertSessionHasErrors('enforce_fiscal_period');
        $this->actingWith(['select'], ['write'])->put(route('fiscalPeriods.enforcement'), ['enforce_fiscal_period' => 'mungkin'])->assertSessionHasErrors('enforce_fiscal_period');
    }

    public function test_uncovered_count_is_zero_without_ledger_rows(): void {
        $this->assertSame(0, $this->periods->uncoveredTransactionCount());
    }

    public function test_uncovered_count_counts_rows_outside_every_period_in_company_timezone(): void {
        $cash  = $this->makeAccount('1100', 'Kas');
        $sales = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $entry = $this->makeStockEntry();
        $this->periods->generateYear(2026);

        // Tercakup: 2026-06-15 dan 31 Des 2026 23.30 WIB (= 16.30 UTC).
        $this->makeLedger($entry, $cash, $sales, 10, 0, '2026-06-15 03:00:00');
        $this->makeLedger($entry, $sales, $cash, 0, 10, '2026-12-31 16:30:00');
        // Tidak tercakup: 31 Des 2026 17.30 UTC = 00.30 WIB 1 Januari 2027; dan 2025.
        $this->makeLedger($entry, $cash, $sales, 5, 0, '2026-12-31 17:30:00');
        $this->makeLedger($entry, $sales, $cash, 0, 5, '2025-12-31 10:00:00');

        $this->assertSame(2, $this->periods->uncoveredTransactionCount());
    }

    public function test_uncovered_count_detects_gaps_between_periods_and_ignores_soft_deleted_rows(): void {
        $cash  = $this->makeAccount('1100', 'Kas');
        $sales = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $entry = $this->makeStockEntry();

        $year = $this->periods->createYear('2026', now()->setDate(2026, 1, 1), now()->setDate(2026, 12, 31));
        $this->periods->createPeriod($year, 'Q1', now()->setDate(2026, 1, 1), now()->setDate(2026, 3, 31));
        $this->periods->createPeriod($year, 'Q3', now()->setDate(2026, 7, 1), now()->setDate(2026, 9, 30));

        $this->makeLedger($entry, $cash, $sales, 1, 0, '2026-02-10 03:00:00');   // Q1
        $this->makeLedger($entry, $sales, $cash, 0, 1, '2026-05-10 03:00:00');   // celah Apr-Jun
        $this->makeLedger($entry, $cash, $sales, 2, 0, '2026-08-10 03:00:00');   // Q3
        $deletedGap = $this->makeLedger($entry, $sales, $cash, 0, 2, '2026-06-10 03:00:00');
        DB::table('general_ledgers')->where('id', $deletedGap->id)->update(['deleted_at' => now()]);

        $this->assertSame(1, $this->periods->uncoveredTransactionCount());
    }

    public function test_uncovered_count_without_any_period_counts_all_active_rows(): void {
        $cash  = $this->makeAccount('1100', 'Kas');
        $sales = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $entry = $this->makeStockEntry();
        $this->makeLedger($entry, $cash, $sales, 1, 0, '2026-02-10 03:00:00');
        $this->makeLedger($entry, $sales, $cash, 0, 1, '2026-02-10 03:00:00');

        $this->assertSame(2, $this->periods->uncoveredTransactionCount());
    }
}
