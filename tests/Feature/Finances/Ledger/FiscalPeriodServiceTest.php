<?php

namespace Tests\Feature\Finances\Ledger;

use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Models\Core\CoreSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 4.2: resolve/assertOpen/generateYear/close/open, larangan tumpang-tindih (Requirement 6.1-6.3,
 * 6.5-6.7) dan perintah `finance:generate-fiscal-year`.
 */
class FiscalPeriodServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private FiscalPeriodService $service;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([FiscalYear::class, FiscalPeriod::class]);
        $this->service = app(FiscalPeriodService::class);
    }

    public function test_generate_year_creates_twelve_calendar_months(): void {
        $year = $this->service->generateYear(2026);

        $this->assertSame('2026', $year->name);
        $this->assertSame('2026-01-01', $year->start_date->toDateString());
        $this->assertSame('2026-12-31', $year->end_date->toDateString());
        $this->assertSame('open', $year->status);

        $periods = $year->periods()->get();
        $this->assertCount(12, $periods);
        $this->assertSame('2026-01-01', $periods->first()->start_date->toDateString());
        $this->assertSame('2026-01-31', $periods->first()->end_date->toDateString());
        $this->assertSame('2026-02-28', $periods[1]->end_date->toDateString());
        $this->assertSame('2026-12-31', $periods->last()->end_date->toDateString());
        $this->assertTrue($periods->every(fn (FiscalPeriod $period) => $period->status === 'open'));
    }

    public function test_generate_year_handles_leap_february(): void {
        $periods = $this->service->generateYear(2028)->periods()->get();

        $this->assertSame('2028-02-29', $periods[1]->end_date->toDateString());
    }

    public function test_generate_year_is_idempotent_and_completes_missing_periods(): void {
        $first = $this->service->generateYear(2026);
        $again = $this->service->generateYear(2026);

        $this->assertSame($first->id, $again->id);
        $this->assertSame(1, FiscalYear::count());
        $this->assertSame(12, FiscalPeriod::count());

        FiscalPeriod::query()->where('name', '2026-05')->delete();
        $this->assertSame(11, FiscalPeriod::count());

        $this->service->generateYear(2026);
        $this->assertSame(12, FiscalPeriod::count());
    }

    public function test_resolve_returns_the_period_covering_a_date_or_null(): void {
        $this->service->generateYear(2026);

        // Batas bulan dalam zona waktu perusahaan (Asia/Jakarta, default setting).
        $this->assertSame('2026-03', $this->service->resolve(CarbonImmutable::parse('2026-03-31 23:59:59', 'Asia/Jakarta'))->name);
        $this->assertSame('2026-04', $this->service->resolve(CarbonImmutable::parse('2026-04-01 00:00:00', 'Asia/Jakarta'))->name);
        $this->assertNull($this->service->resolve(CarbonImmutable::parse('2027-01-01', 'Asia/Jakarta')));
    }

    public function test_assert_open_rejects_closed_and_undefined_periods(): void {
        $this->service->generateYear(2026);
        $this->service->close($this->service->resolve(CarbonImmutable::parse('2026-02-10')));

        $this->assertSame('2026-01', $this->service->assertOpen(CarbonImmutable::parse('2026-01-10'))->name);

        try {
            $this->service->assertOpen(CarbonImmutable::parse('2026-02-10'));
            $this->fail('Periode tertutup harus ditolak.');
        } catch (ClosedPeriodException $e) {
            $this->assertStringContainsString('2026-02', $e->getMessage());
        }

        $this->expectException(ClosedPeriodException::class);
        $this->service->assertOpen(CarbonImmutable::parse('2030-01-01'));
    }

    public function test_close_and_open_record_who_when_and_log_the_change(): void {
        Event::fake([AuditableModelSaved::class]);
        $this->service->generateYear(2026);
        $period = $this->service->resolve(CarbonImmutable::parse('2026-01-15'));

        $closed = $this->service->close($period, 'Tutup Januari');
        $this->assertSame('closed', $closed->status);
        $this->assertNotNull($closed->closed_at);
        $this->assertSame($this->user->id, $closed->closed_by_id);
        Event::assertDispatched(AuditableModelSaved::class, fn ($event) => $event->action === 'closed'
            && $event->model->is($period)
            && $event->dataBefore['status'] === 'open'
            && $event->dataAfter['status'] === 'closed'
            && $event->dataAfter['reason'] === 'Tutup Januari');

        $reopened = $this->service->open($period->refresh(), 'Koreksi');
        $this->assertSame('open', $reopened->status);
        $this->assertNull($reopened->closed_at);
        $this->assertNull($reopened->closed_by_id);
        Event::assertDispatched(AuditableModelSaved::class, fn ($event) => $event->action === 'reopened' && $event->dataAfter['reason'] === 'Koreksi');
    }

    public function test_closing_an_already_closed_period_is_a_noop(): void {
        Event::fake([AuditableModelSaved::class]);
        $this->service->generateYear(2026);
        $period = $this->service->resolve(CarbonImmutable::parse('2026-01-15'));

        $this->service->close($period);
        $this->service->close($period->refresh());

        $this->assertCount(1, Event::dispatched(AuditableModelSaved::class, fn ($event) => $event->action === 'closed'));
    }

    public function test_overlapping_years_are_rejected(): void {
        $this->service->generateYear(2026);

        $this->expectException(ValidationException::class);
        $this->service->createYear('FY-overlap', CarbonImmutable::parse('2026-07-01'), CarbonImmutable::parse('2027-06-30'));
    }

    public function test_a_non_calendar_year_is_supported_by_the_structure(): void {
        $year = $this->service->createYear('FY 2026/27', CarbonImmutable::parse('2026-07-01'), CarbonImmutable::parse('2027-06-30'));
        $this->service->createPeriod($year, '2026-07', CarbonImmutable::parse('2026-07-01'), CarbonImmutable::parse('2026-07-31'));

        $this->assertSame('2026-07', $this->service->resolve(CarbonImmutable::parse('2026-07-20'))->name);
    }

    public function test_year_end_before_start_is_rejected(): void {
        $this->expectException(ValidationException::class);
        $this->service->createYear('Terbalik', CarbonImmutable::parse('2026-12-31'), CarbonImmutable::parse('2026-01-01'));
    }

    public function test_overlapping_and_out_of_range_periods_are_rejected(): void {
        $year = $this->service->createYear('FY 2026', CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2026-12-31'));
        $this->service->createPeriod($year, 'Q1', CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2026-03-31'));

        foreach ([
            ['Q1-overlap', '2026-03-31', '2026-04-30'],
            ['Di dalam', '2026-02-01', '2026-02-28'],
            ['Di luar tahun', '2026-12-01', '2027-01-31'],
            ['Sebelum tahun', '2025-12-01', '2025-12-31'],
            ['Q1', '2026-04-01', '2026-06-30'],
        ] as [$name, $start, $end]) {
            try {
                $this->service->createPeriod($year, $name, CarbonImmutable::parse($start), CarbonImmutable::parse($end));
                $this->fail("Periode {$name} {$start}..{$end} harus ditolak.");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->assertSame(1, FiscalPeriod::count());
    }

    public function test_generate_command_is_idempotent(): void {
        $this->artisan('finance:generate-fiscal-year', ['year' => 2026])->assertSuccessful();
        $this->artisan('finance:generate-fiscal-year', ['year' => 2026])->assertSuccessful();

        $this->assertSame(1, FiscalYear::count());
        $this->assertSame(12, FiscalPeriod::count());
    }

    public function test_generate_command_rejects_an_invalid_year(): void {
        $this->artisan('finance:generate-fiscal-year', ['year' => 'abc'])->assertFailed();
        $this->artisan('finance:generate-fiscal-year', ['year' => 99])->assertFailed();

        $this->assertSame(0, FiscalYear::count());
    }

    public function test_generate_year_rejects_an_existing_non_calendar_year_with_an_explicit_message(): void {
        $this->service->createYear('2026', CarbonImmutable::parse('2026-04-01'), CarbonImmutable::parse('2027-03-31'));

        try {
            $this->service->generateYear(2026);
            $this->fail('Tahun non-kalender bernama sama harus ditolak.');
        } catch (ValidationException $e) {
            $message = $e->errors()['year'][0];
            $this->assertStringNotContainsString('finances/fiscalYear.errors', $message, 'Kunci terjemahan harus ada.');
            $this->assertStringContainsString('2026-04-01', $message);
            $this->assertStringContainsString('2027-03-31', $message);
        }

        $this->assertSame(0, FiscalPeriod::count(), 'Tidak ada periode bulanan kalender yang dibuat.');
    }

    public function test_period_day_follows_the_company_timezone_setting(): void {
        $this->service->generateYear(2026);
        $this->assertSame('Asia/Jakarta', $this->service->companyTimezone(), 'Default CoreSetting.timezone.');

        // 17.30 UTC tanggal 30 November = 00.30 WIB tanggal 1 Desember: bulan WIB, bukan bulan UTC.
        $instant = CarbonImmutable::parse('2026-11-30 17:30:00', 'UTC');
        $this->assertSame('2026-12-01', $this->service->businessDay($instant));
        $this->assertSame('2026-12', $this->service->resolve($instant)->name);

        // 23.30 WIB tanggal 30 November tetap November.
        $lateWib = CarbonImmutable::parse('2026-11-30 23:30:00', 'Asia/Jakarta');
        $this->assertSame('2026-11', $this->service->resolve($lateWib)->name);

        // Batas tahun: 20.00 UTC 31 Desember = 03.00 WIB 1 Januari 2027 (belum ada periodenya).
        $this->assertNull($this->service->resolve(CarbonImmutable::parse('2026-12-31 20:00:00', 'UTC')));
        $this->expectException(ClosedPeriodException::class);
        $this->service->assertOpen(CarbonImmutable::parse('2026-12-31 20:00:00', 'UTC'));
    }

    public function test_changing_the_company_timezone_changes_the_period_day(): void {
        $this->service->generateYear(2026);
        $instant = CarbonImmutable::parse('2026-11-30 17:30:00', 'UTC');
        $this->assertSame('2026-12', $this->service->resolve($instant)->name);

        app(SettingsService::class)->update(CoreSetting::class, ['timezone' => 'UTC']);

        $this->assertSame('UTC', $this->service->companyTimezone());
        $this->assertSame('2026-11', $this->service->resolve($instant)->name);
    }

    public function test_status_columns_cannot_be_mass_assigned(): void {
        $year   = $this->service->generateYear(2026);
        $period = $year->periods()->first();

        $period->fill(['status' => 'closed', 'closed_at' => now(), 'closed_by_id' => 'x', 'name' => 'ubah']);
        $year->fill(['status' => 'closed', 'name' => 'ubah']);

        $this->assertSame('open', $period->status);
        $this->assertNull($period->closed_at);
        $this->assertNull($period->closed_by_id);
        $this->assertSame('ubah', $period->name, 'Kolom non-status tetap dapat diisi.');
        $this->assertSame('open', $year->status);
        $this->assertSame('ubah', $year->name);
    }
}
