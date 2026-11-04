<?php

namespace Tests\Feature\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 4.3 dan 4.4 (bagian DB): `JournalService::post()`/`postPair()` (Requirement 2, 3, 6.5-6.6).
 * `lockForUpdate`/`sharedLock` tidak berefek di SQLite, sehingga konkurensi diuji lewat idempotensi dan atomisitas.
 * Invarian P-1 (seimbang) diuji massal tanpa database di `JournalDraftValidatorTest`.
 */
class JournalServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private JournalService $service;
    private Account $cash;
    private Account $revenue;
    private Account $tax;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $this->tax     = $this->makeAccount('2100', 'Utang Pajak', 'liability', 'credit');
        $this->service = app(JournalService::class);
    }

    private function date(string $value = '2026-11-04 10:30:00'): CarbonImmutable {
        return CarbonImmutable::parse($value);
    }

    /**
     * @param  list<JournalLineDraft>  $lines
     */
    private function draft(array $lines, ?string $key = null, string $date = '2026-11-04 10:30:00'): JournalDraft {
        return new JournalDraft($this->date($date), $lines, $this->branch, $key, $this->branch->id, 'Penjualan tunai');
    }

    private function twoLines(float|string $amount = 150000): array {
        return [
            new JournalLineDraft($this->cash->id, $amount, 0, againstAccountId: $this->revenue->id),
            new JournalLineDraft($this->revenue->id, 0, $amount, againstAccountId: $this->cash->id),
        ];
    }

    private function assertNothingPosted(): void {
        $this->assertSame(0, Journal::count(), 'Tidak boleh ada jurnal.');
        $this->assertSame(0, GeneralLedger::withTrashed()->count(), 'Tidak boleh ada baris GL.');
    }

    public function test_post_writes_journal_and_all_lines_atomically_with_full_metadata(): void {
        $journal = $this->service->post($this->draft($this->twoLines(150000.5)));

        $this->assertInstanceOf(Journal::class, $journal);
        $this->assertMatchesRegularExpression('#^JV-0001/\d{2}$#', $journal->code);
        $this->assertSame(JournalStatus::Posted->value, $journal->status);
        $this->assertSame('150000.5000', $journal->total_debit);
        $this->assertSame('150000.5000', $journal->total_credit);
        $this->assertSame($this->branch::class, $journal->source_type);
        $this->assertSame($this->branch->id, $journal->source_id);
        $this->assertSame($this->branch->id, $journal->branch_id);
        $this->assertSame($this->user->id, $journal->posted_by_id);
        $this->assertNotNull($journal->posted_at);
        $this->assertFalse($journal->legacy_origin);
        $this->assertFalse($journal->legacy_unbalanced);
        $this->assertSame('Penjualan tunai', $journal->description);
        $this->assertSame('2026-11-04', $journal->transaction_date->toDateString());

        $lines = GeneralLedger::query()->where('journal_id', $journal->id)->orderBy('line_no')->get();
        $this->assertCount(2, $lines);
        $this->assertSame([1, 2], $lines->pluck('line_no')->all());
        $this->assertSame([$this->cash->id, $this->revenue->id], $lines->pluck('account_id')->all());
        $this->assertSame([150000.5, 0.0], $lines->pluck('debit')->all());
        $this->assertSame([0.0, 150000.5], $lines->pluck('credit')->all());
        $this->assertSame([$this->revenue->id, $this->cash->id], $lines->pluck('against_account_id')->all());
        foreach ($lines as $line) {
            $this->assertSame($this->branch::class, $line->referenceable_type);
            $this->assertSame($this->branch->id, $line->referenceable_id);
            $this->assertSame($this->branch->id, $line->branch_id);
            $this->assertSame('2026-11-04 10:30:00', $line->transaction_date->format('Y-m-d H:i:s'));
            $this->assertSame('Penjualan tunai', $line->description);
        }

        $this->assertCount(2, $journal->lines, 'Relasi lines pada jurnal yang dikembalikan harus terisi.');
    }

    public function test_journal_codes_increase_per_posting(): void {
        $first  = $this->service->post($this->draft($this->twoLines(10)));
        $second = $this->service->post($this->draft($this->twoLines(20)));

        $this->assertStringStartsWith('JV-0001/', $first->code);
        $this->assertStringStartsWith('JV-0002/', $second->code);
    }

    public function test_journal_with_three_lines_leaves_against_account_null(): void {
        $journal = $this->service->post($this->draft([
            new JournalLineDraft($this->cash->id, 111000, 0),
            new JournalLineDraft($this->revenue->id, 0, 100000),
            new JournalLineDraft($this->tax->id, 0, 11000),
        ]));

        $lines = $journal->lines()->get();
        $this->assertCount(3, $lines);
        $this->assertSame([null, null, null], $lines->pluck('against_account_id')->all());
        $this->assertSame('111000.0000', $journal->total_debit);
    }

    public function test_party_and_line_description_are_written_to_the_line(): void {
        $journal = $this->service->post($this->draft([
            new JournalLineDraft($this->cash->id, 50, 0, party: $this->branch, description: 'Baris kas'),
            new JournalLineDraft($this->revenue->id, 0, 50),
        ]));

        $first  = $journal->lines()->get()[0];
        $second = $journal->lines()->get()[1];
        $this->assertSame($this->branch::class, $first->partyable_type);
        $this->assertSame($this->branch->id, $first->partyable_id);
        $this->assertSame('Baris kas', $first->description);
        $this->assertNull($second->partyable_type);
        $this->assertSame('Penjualan tunai', $second->description, 'Deskripsi baris default ke deskripsi jurnal.');
    }

    public function test_sourceless_journal_references_itself(): void {
        $journal = $this->service->post(new JournalDraft($this->date(), $this->twoLines(5)));

        $this->assertNull($journal->source_type);
        $this->assertNull($journal->source_id);
        foreach ($journal->lines()->get() as $line) {
            $this->assertSame(Journal::class, $line->referenceable_type);
            $this->assertSame($journal->id, $line->referenceable_id);
        }
    }

    public function test_invalid_drafts_leave_no_rows(): void {
        $cases = [
            'satu baris'   => [[new JournalLineDraft($this->cash->id, 10, 0)], InvalidJournalException::class],
            'negatif'      => [[new JournalLineDraft($this->cash->id, -10, 0), new JournalLineDraft($this->revenue->id, 0, -10)], InvalidJournalException::class],
            'dua sisi'     => [[new JournalLineDraft($this->cash->id, 10, 10), new JournalLineDraft($this->revenue->id, 0, 10)], InvalidJournalException::class],
            'nol'          => [[new JournalLineDraft($this->cash->id, 0, 0), new JournalLineDraft($this->revenue->id, 0, 10)], InvalidJournalException::class],
            'tak seimbang' => [[new JournalLineDraft($this->cash->id, 100, 0), new JournalLineDraft($this->revenue->id, 0, 99.99)], UnbalancedJournalException::class],
        ];

        foreach ($cases as $label => [$lines, $exception]) {
            try {
                $this->service->post($this->draft($lines));
                $this->fail("Kasus '{$label}' harus ditolak.");
            } catch (\Throwable $e) {
                $this->assertInstanceOf($exception, $e, $label);
            }
        }

        $this->assertNothingPosted();
    }

    public function test_unbalanced_exception_carries_the_difference(): void {
        try {
            $this->service->post($this->draft([new JournalLineDraft($this->cash->id, 100, 0), new JournalLineDraft($this->revenue->id, 0, 99.99)]));
            $this->fail('Harus tidak seimbang.');
        } catch (UnbalancedJournalException $e) {
            $this->assertSame(1, $e->differenceMinor);
        }
    }

    public function test_p2_failure_on_a_later_line_rolls_back_the_journal_and_earlier_lines(): void {
        // Baris ke-2 memiliki akun lawan yang tidak ada: pelanggaran FK terjadi saat baris itu ditulis, setelah
        // jurnal dan baris pertama masuk.
        $lines = [
            new JournalLineDraft($this->cash->id, 10, 0, againstAccountId: $this->revenue->id),
            new JournalLineDraft($this->revenue->id, 0, 10, againstAccountId: (string) Str::ulid()),
        ];

        try {
            $this->service->post($this->draft($lines, 'k:1:default'));
            $this->fail('Pelanggaran FK harus menggagalkan posting.');
        } catch (QueryException) {
            $this->addToAssertionCount(1);
        }

        $this->assertNothingPosted();

        // Kunci posting dan nomor tidak terpakai: posting ulang yang valid berhasil sebagai JV-0001.
        $journal = $this->service->post($this->draft($this->twoLines(10), 'k:1:default'));
        $this->assertStringStartsWith('JV-0001/', $journal->code);
    }

    public function test_p3_duplicate_posting_key_throws_with_existing_journal_and_creates_nothing_new(): void {
        $first = $this->service->post($this->draft($this->twoLines(10), 'doc:1:default'));

        try {
            $this->service->post($this->draft($this->twoLines(10), 'doc:1:default'));
            $this->fail('Kunci ganda harus ditolak.');
        } catch (DuplicatePostingException $e) {
            $this->assertSame($first->id, $e->journalId);
            $this->assertSame('doc:1:default', $e->postingKey);
        }

        $this->assertSame(1, Journal::count());
        $this->assertSame(2, GeneralLedger::count());

        $other = $this->service->post($this->draft($this->twoLines(10), 'doc:1:other'));
        $this->assertNotSame($first->id, $other->id);
        $this->assertStringStartsWith('JV-0002/', $other->code, 'Penolakan duplikat tidak boleh menghabiskan nomor urut.');
    }

    public function test_p3_unique_violation_race_is_translated_to_duplicate_posting(): void {
        // Menyimulasikan balapan: pra-pemeriksaan tidak melihat baris, lalu proses lain meng-commit jurnal dengan kunci
        // yang sama tepat sebelum INSERT kita (event `creating`), sehingga INSERT menabrak kunci unik.
        $competitorId = (string) Str::ulid();
        Journal::creating(function (Journal $journal) use ($competitorId) {
            static $fired = false;
            if ($fired) {
                return;
            }
            $fired = true;
            DB::table('journals')->insert([
                'id'               => $competitorId,
                'code'             => 'JV-LAWAN',
                'transaction_date' => '2026-11-04 10:30:00',
                'status'           => 'posted',
                'posting_key'      => 'race:1:default',
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        });

        try {
            $this->service->post($this->draft($this->twoLines(10), 'race:1:default'));
            $this->fail('Pelanggaran unik harus menjadi DuplicatePostingException.');
        } catch (DuplicatePostingException $e) {
            $this->assertSame($competitorId, $e->journalId);
        }

        // Jurnal pesaing disisipkan di dalam transaksi uji yang sama, jadi ikut tergulung; yang dibuktikan di sini
        // adalah tidak ada baris GL yang tersisa dari percobaan kita.
        $this->assertSame(0, GeneralLedger::count());
    }

    public function test_invalid_accounts_are_rejected(): void {
        $group = $this->makeAccount('1000', 'Aset', 'asset', 'debit');
        $group->update(['is_group' => true]);
        $disabled = $this->makeAccount('1900', 'Nonaktif', 'asset', 'debit');
        $disabled->update(['is_disabled' => true]);
        $deleted = $this->makeAccount('1901', 'Terhapus', 'asset', 'debit');
        $deleted->delete();

        foreach ([
            'grup'     => $group->id,
            'nonaktif' => $disabled->id,
            'terhapus' => $deleted->id,
            'hilang'   => (string) Str::ulid(),
        ] as $label => $accountId) {
            try {
                $this->service->post($this->draft([
                    new JournalLineDraft($accountId, 10, 0),
                    new JournalLineDraft($this->revenue->id, 0, 10),
                ]));
                $this->fail("Akun {$label} harus ditolak.");
            } catch (InvalidJournalException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->assertNothingPosted();
    }

    public function test_p8_enforcement_off_fills_period_when_found_and_never_rejects_for_periods(): void {
        $this->assertFalse((bool) FinanceSetting::current()->enforce_fiscal_period);

        $undefined = $this->service->post($this->draft($this->twoLines(10), null, '2026-11-04 10:00:00'));
        $this->assertNull($undefined->fiscal_period_id);

        $year = app(FiscalPeriodService::class)->generateYear(2026);
        app(FiscalPeriodService::class)->close(app(FiscalPeriodService::class)->resolve($this->date('2026-11-10')));

        $inClosed = $this->service->post($this->draft($this->twoLines(10), null, '2026-11-10 09:00:00'));
        $this->assertSame('2026-11', FiscalPeriod::find($inClosed->fiscal_period_id)->name);

        $inOpen = $this->service->post($this->draft($this->twoLines(10), null, '2026-10-10 09:00:00'));
        $this->assertSame('2026-10', FiscalPeriod::find($inOpen->fiscal_period_id)->name);
        $this->assertSame($year->id, FiscalPeriod::find($inOpen->fiscal_period_id)->fiscal_year_id);
    }

    public function test_p8_enforcement_on_rejects_closed_and_undefined_periods_but_accepts_open(): void {
        app(FiscalPeriodService::class)->generateYear(2026);
        app(FiscalPeriodService::class)->close(app(FiscalPeriodService::class)->resolve($this->date('2026-11-10')));
        FinanceSetting::current();
        DB::table('finance_settings')->update(['enforce_fiscal_period' => true]);

        $ok = $this->service->post($this->draft($this->twoLines(10), null, '2026-10-10 09:00:00'));
        $this->assertNotNull($ok->fiscal_period_id);

        foreach (['2026-11-10 09:00:00', '2027-02-01 09:00:00', '2020-01-01 00:00:00'] as $date) {
            try {
                $this->service->post($this->draft($this->twoLines(10), null, $date));
                $this->fail("Posting {$date} harus ditolak.");
            } catch (ClosedPeriodException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->assertSame(1, Journal::count());
        $this->assertSame(2, GeneralLedger::count());
    }

    public function test_base_currency_minor_unit_drives_rounding_and_currency_code(): void {
        Currency::create(['code' => 'JPY', 'name' => 'Yen', 'minor_unit' => 0, 'numeric_code' => '392']);
        CoreSetting::current();
        DB::table('core_settings')->update(['default_currency_id' => 'JPY']);

        // 100.4 dan 99.6 sama-sama menjadi 100 dan 100 pada minor unit 0.
        $journal = $this->service->post($this->draft([
            new JournalLineDraft($this->cash->id, 100.4, 0),
            new JournalLineDraft($this->revenue->id, 0, 99.6),
        ]));

        $this->assertSame('JPY', $journal->currency_code);
        $this->assertSame('100.0000', $journal->total_debit);
        $this->assertSame([100.0, 0.0], $journal->lines()->get()->pluck('debit')->all());
    }

    public function test_default_currency_idr_uses_two_decimals_and_sets_currency_code(): void {
        Currency::create(['code' => 'IDR', 'name' => 'Rupiah', 'minor_unit' => 2]);
        CoreSetting::current();
        DB::table('core_settings')->update(['default_currency_id' => 'IDR']);

        $journal = $this->service->post($this->draft($this->twoLines('10.005')));

        $this->assertSame('IDR', $journal->currency_code);
        $this->assertSame('10.0100', $journal->total_debit);
    }

    public function test_missing_series_fails_with_a_clear_exception_and_leaves_no_rows(): void {
        FormatingSeries::query()->where('model', Journal::class)->delete();

        $this->expectException(InvalidJournalException::class);
        try {
            $this->service->post($this->draft($this->twoLines(10)));
        } finally {
            $this->assertNothingPosted();
        }
    }

    public function test_post_pair_builds_a_two_line_journal_with_against_accounts_and_posting_key(): void {
        $journal = $this->service->postPair($this->cash->id, $this->revenue->id, 150000, $this->branch, $this->date(), 'default', branchId: $this->branch->id);

        $this->assertSame($this->branch::class . ":{$this->branch->id}:default", $journal->posting_key);
        $lines = $journal->lines()->get();
        $this->assertSame([$this->cash->id, $this->revenue->id], $lines->pluck('account_id')->all());
        $this->assertSame([150000.0, 0.0], $lines->pluck('debit')->all());
        $this->assertSame([0.0, 150000.0], $lines->pluck('credit')->all());
        $this->assertSame([$this->revenue->id, $this->cash->id], $lines->pluck('against_account_id')->all());
    }

    public function test_post_pair_reverse_sides_swaps_debit_and_credit(): void {
        $journal = $this->service->postPair($this->cash->id, $this->revenue->id, 75, $this->branch, $this->date(), 'default', reverseSides: true);

        $lines = $journal->lines()->get();
        $this->assertSame($this->revenue->id, $lines->firstWhere('debit', 75.0)->account_id);
        $this->assertSame($this->cash->id, $lines->firstWhere('credit', 75.0)->account_id);
    }

    public function test_post_pair_with_zero_amount_posts_nothing_and_returns_null(): void {
        $this->assertNull($this->service->postPair($this->cash->id, $this->revenue->id, 0, $this->branch, $this->date()));
        $this->assertNull($this->service->postPair($this->cash->id, $this->revenue->id, '0.00', $this->branch, $this->date()));
        $this->assertNull($this->service->postPair($this->cash->id, $this->revenue->id, 0.004, $this->branch, $this->date()));

        $this->assertNothingPosted();
    }

    public function test_post_pair_is_idempotent_per_source_and_purpose(): void {
        $this->service->postPair($this->cash->id, $this->revenue->id, 10, $this->branch, $this->date(), 'stock');
        $this->service->postPair($this->cash->id, $this->revenue->id, 10, $this->branch, $this->date(), 'expense');

        $this->assertSame(2, Journal::count(), 'Purpose berbeda atas sumber yang sama menjadi dua jurnal.');

        $this->expectException(DuplicatePostingException::class);
        $this->service->postPair($this->cash->id, $this->revenue->id, 10, $this->branch, $this->date(), 'stock');
    }

    public function test_post_pair_rejects_a_negative_amount(): void {
        $this->expectException(InvalidJournalException::class);
        $this->service->postPair($this->cash->id, $this->revenue->id, -10, $this->branch, $this->date());
    }

    /**
     * Nilai mentah `transaction_date` di DB (tanpa cast Eloquent).
     */
    private function rawDate(string $table, string $column, string $id): string {
        return (string) DB::table($table)->where($column, $id)->value('transaction_date');
    }

    public function test_period_is_resolved_in_company_timezone_and_the_date_is_stored_in_utc(): void {
        $periods = app(FiscalPeriodService::class);
        $periods->generateYear(2026);

        // 23.30 WIB tanggal 30 November = 16.30 UTC: November di kedua zona (`draft()` mem-parse dalam UTC).
        $lateNovember = $this->service->post($this->draft($this->twoLines(10), null, '2026-11-30 16:30:00'));
        $this->assertSame('2026-11', FiscalPeriod::find($lateNovember->fiscal_period_id)->name);

        // Input dalam zona WIB dinormalisasi ke UTC sebelum disimpan: jam dinding 23.30 WIB menjadi 16.30 UTC.
        $wib  = new JournalDraft(CarbonImmutable::parse('2026-11-30 23:30:00', 'Asia/Jakarta'), $this->twoLines(10), $this->branch, null, $this->branch->id);
        $late = $this->service->post($wib);
        $this->assertSame('2026-11-30 16:30:00', $this->rawDate('journals', 'id', $late->id));
        $this->assertSame('2026-11', FiscalPeriod::find($late->fiscal_period_id)->name);

        // 00.30 WIB tanggal 1 Desember = 17.30 UTC tanggal 30 November: periode Desember (bulan WIB), bukan November.
        $firstDecember = $this->service->post($this->draft($this->twoLines(10), null, '2026-11-30 17:30:00'));
        $this->assertSame('2026-12', FiscalPeriod::find($firstDecember->fiscal_period_id)->name);

        $wibMidnight = new JournalDraft(CarbonImmutable::parse('2026-12-01 00:30:00', 'Asia/Jakarta'), $this->twoLines(10), $this->branch, null, $this->branch->id);
        $december    = $this->service->post($wibMidnight);
        $this->assertSame('2026-11-30 17:30:00', $this->rawDate('journals', 'id', $december->id));
        $this->assertSame('2026-12', FiscalPeriod::find($december->fiscal_period_id)->name);

        // Konsistensi: menghitung ulang periode dari tanggal TERSIMPAN (UTC) selalu sama dengan `fiscal_period_id`.
        foreach ([$lateNovember, $firstDecember, $late, $december] as $journal) {
            $stored = CarbonImmutable::parse($this->rawDate('journals', 'id', $journal->id), 'UTC');
            $this->assertSame($journal->fiscal_period_id, $periods->resolve($stored)->id, "Periode jurnal {$journal->code} tidak cocok dengan tanggal tersimpan.");
            foreach (GeneralLedger::where('journal_id', $journal->id)->pluck('id') as $lineId) {
                $this->assertSame($this->rawDate('journals', 'id', $journal->id), $this->rawDate('general_ledgers', 'id', $lineId), 'Baris GL memakai tanggal tersimpan yang sama.');
            }
        }
    }

    public function test_enforcement_uses_the_company_timezone_day_for_closed_periods(): void {
        app(FiscalPeriodService::class)->generateYear(2026);
        app(FiscalPeriodService::class)->close(app(FiscalPeriodService::class)->resolve($this->date('2026-12-10')));
        FinanceSetting::current();
        DB::table('finance_settings')->update(['enforce_fiscal_period' => true]);

        // 17.30 UTC 30 November adalah 1 Desember WIB: periode Desember sudah ditutup.
        $this->expectException(ClosedPeriodException::class);
        $this->service->post($this->draft($this->twoLines(10), null, '2026-11-30 17:30:00'));
    }

    public function test_base_currency_is_read_once_per_post_pair(): void {
        Currency::create(['code' => 'IDR', 'name' => 'Rupiah', 'minor_unit' => 2]);
        CoreSetting::current()->forceFill(['default_currency_id' => 'IDR'])->save();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->service->postPair($this->cash->id, $this->revenue->id, 10, $this->branch, $this->date());
        $queries = collect(DB::getQueryLog())->pluck('query');
        DB::disableQueryLog();

        $this->assertSame(1, $queries->filter(fn (string $sql) => str_contains($sql, 'from "currencies"'))->count(), 'Minor unit mata uang dasar dibaca sekali per posting.');
        // Tiga pembacaan sah: mata uang dasar (`getForRead`), zona waktu perusahaan (`getForRead` di FiscalPeriodService),
        // dan zona waktu penomoran seri (`FormatingSeries::generate`, di luar cakupan perbaikan ini); tidak bertambah per baris.
        $this->assertLessThanOrEqual(3, $queries->filter(fn (string $sql) => str_contains($sql, 'from "core_settings"'))->count(), 'Setting umum tidak dibaca berulang per posting.');
    }

    public function test_company_timezone_is_read_once_when_enforcement_is_active(): void {
        Currency::create(['code' => 'IDR', 'name' => 'Rupiah', 'minor_unit' => 2]);
        CoreSetting::current()->forceFill(['default_currency_id' => 'IDR'])->save();
        app(FiscalPeriodService::class)->generateYear(2026);
        FinanceSetting::current();
        DB::table('finance_settings')->update(['enforce_fiscal_period' => true]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $journal = $this->service->postPair($this->cash->id, $this->revenue->id, 10, $this->branch, $this->date());
        $queries = collect(DB::getQueryLog())->pluck('query');
        DB::disableQueryLog();

        $this->assertNotNull($journal->fiscal_period_id);
        // `assertOpen()` menghitung hari bisnis sekali: mata uang dasar + zona waktu perusahaan + zona waktu penomoran seri.
        $this->assertLessThanOrEqual(3, $queries->filter(fn (string $sql) => str_contains($sql, 'from "core_settings"'))->count(), 'Zona waktu dibaca berulang saat penegakan aktif.');
    }

    public function test_integrity_columns_cannot_be_mass_assigned(): void {
        $journal = $this->service->post($this->draft($this->twoLines(10), 'doc:1:default'));

        $journal->fill([
            'status'                 => 'voided',
            'posting_key'            => 'x',
            'total_debit'            => 1,
            'total_credit'           => 1,
            'legacy_origin'          => true,
            'legacy_unbalanced'      => true,
            'reverses_journal_id'    => 'x',
            'reversed_by_journal_id' => 'x',
            'reversal_reason'        => 'x',
            'description'            => 'boleh',
        ]);

        $this->assertSame('posted', $journal->status);
        $this->assertSame('doc:1:default', $journal->posting_key);
        $this->assertSame('10.0000', $journal->total_debit);
        $this->assertFalse($journal->legacy_origin);
        $this->assertNull($journal->reverses_journal_id);
        $this->assertSame('boleh', $journal->description, 'Kolom non-integritas tetap dapat diisi.');
    }
}
