<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\ImmutableRateException;
use App\Exceptions\Finances\InvalidExchangeRateException;
use App\Models\Core\Log;
use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\ExchangeRateRecorder;
use App\Services\Finances\Currency\Providers\CsvImportProvider;
use App\Services\Finances\Currency\Providers\ExchangeRateProvider;
use App\Services\Finances\Currency\Providers\ManualProvider;
use App\Services\Finances\Currency\Providers\RateImportReport;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 2.5 dan 2.6: penyedia kurs manual/CSV, validasi per baris, laporan galat, idempoten.
 */
class ExchangeRateImportTest extends TestCase {
    use CreatesExchangeRates, RefreshDatabase;

    private const HEADER = 'from_currency_code,to_currency_code,rate_type,rate,rate_date';

    protected function setUp(): void {
        parent::setUp();
        $this->seedCurrencies();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function row(array $overrides = []): array {
        return array_merge([
            'from_currency_code' => 'USD',
            'to_currency_code'   => 'IDR',
            'rate_type'          => 'transaction',
            'rate'               => '15500',
            'rate_date'          => '2026-11-27',
        ], $overrides);
    }

    private function csv(): CsvImportProvider {
        return app(CsvImportProvider::class);
    }

    private function manual(): ManualProvider {
        return app(ManualProvider::class);
    }

    public function test_providers_implement_the_contract_and_need_no_network(): void {
        $this->assertInstanceOf(ExchangeRateProvider::class, $this->manual());
        $this->assertInstanceOf(ExchangeRateProvider::class, $this->csv());
        $this->assertSame('manual', $this->manual()->source());
        $this->assertSame('import', $this->csv()->source());
    }

    public function test_manual_provider_creates_a_rate_with_source_and_creator(): void {
        $outcome = $this->manual()->store($this->row(), 'input form');

        $this->assertSame(ExchangeRateRecorder::CREATED, $outcome);
        $rate = ExchangeRate::query()->firstOrFail();
        $this->assertSame('manual', $rate->source);
        $this->assertSame('input form', $rate->source_ref);
        $this->assertSame('15500.00000000', $rate->rate);
        $this->assertSame(RateType::Transaction, $rate->rate_type);
    }

    public function test_manual_provider_is_idempotent_and_corrects_unreferenced_rates(): void {
        $this->manual()->store($this->row());

        $this->assertSame(ExchangeRateRecorder::UNCHANGED, $this->manual()->store($this->row(['rate' => '15500.000'])));
        $this->assertSame(ExchangeRateRecorder::UPDATED, $this->manual()->store($this->row(['rate' => '15550'])));
        $this->assertSame(1, ExchangeRate::query()->count());
        $this->assertSame('15550.00000000', ExchangeRate::query()->firstOrFail()->rate);
    }

    public function test_manual_provider_refuses_to_change_a_referenced_rate(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27', referenced: true);

        $this->assertSame(ExchangeRateRecorder::UNCHANGED, $this->manual()->store($this->row()), 'Nilai sama bukan perubahan.');

        $this->expectException(ImmutableRateException::class);
        $this->manual()->store($this->row(['rate' => '15600']));
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidRows(): array {
        return [
            'same currency'      => [['to_currency_code' => 'USD'], 'to_currency_code'],
            'unknown from'       => [['from_currency_code' => 'XXX'], 'from_currency_code'],
            'unknown to'         => [['to_currency_code' => 'ZZZ'], 'to_currency_code'],
            'zero rate'          => [['rate' => '0'], 'rate'],
            'zero with decimals' => [['rate' => '0.00000000'], 'rate'],
            'negative rate'      => [['rate' => '-1'], 'rate'],
            'non numeric rate'   => [['rate' => 'abc'], 'rate'],
            'exponent rate'      => [['rate' => '1e3'], 'rate'],
            'nine decimals'      => [['rate' => '1.123456789'], 'rate'],
            'too large'          => [['rate' => '1000000000000'], 'rate'],
            'unknown type'       => [['rate_type' => 'average'], 'rate_type'],
            'bad date format'    => [['rate_date' => '27/11/2026'], 'rate_date'],
            'impossible date'    => [['rate_date' => '2026-02-30'], 'rate_date'],
            'missing rate'       => [['rate' => ''], 'rate'],
            'missing date'       => [['rate_date' => null], 'rate_date'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('invalidRows')]
    public function test_invalid_input_is_rejected_and_nothing_is_stored(array $overrides, string $field): void {
        try {
            $this->manual()->store($this->row($overrides));
            $this->fail('Baris tidak valid harus ditolak.');
        } catch (InvalidExchangeRateException $e) {
            $this->assertArrayHasKey($field, $e->errors);
        }

        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_the_largest_supported_rate_and_eight_decimals_are_accepted(): void {
        $this->manual()->store($this->row(['rate' => '999999999999', 'rate_date' => '2026-11-01']));
        $this->manual()->store($this->row(['rate' => '0.00000001', 'rate_date' => '2026-11-02']));

        $this->assertSame(2, ExchangeRate::query()->count());
    }

    public function test_csv_import_creates_valid_rows_and_reports_each_invalid_row(): void {
        $csv = implode("\n", [
            self::HEADER,                              // 1
            'USD,IDR,transaction,15500,2026-11-27',    // 2 valid
            'EUR,IDR,closing,17000.5,2026-11-27',      // 3 valid
            'USD,IDR,transaction,0,2026-11-26',        // 4 rate 0
            'XXX,IDR,transaction,1,2026-11-26',        // 5 mata uang tak dikenal
            'USD,USD,transaction,1,2026-11-26',        // 6 from = to
            'USD,IDR,average,1,2026-11-26',            // 7 tipe tak dikenal
            'USD,IDR,transaction,15500,26-11-2026',    // 8 tanggal salah
            '',                                        // 9 baris kosong dilewati
            'USD,IDR,transaction,15500',               // 10 jumlah kolom salah
            'JPY,IDR,spot,105.25,2026-11-25',          // 11 valid
        ]);

        $report = $this->csv()->importString($csv, 'kurs.csv');

        $this->assertSame(3, $report->created);
        $this->assertSame(0, $report->updated);
        $this->assertSame([4, 5, 6, 7, 8, 10], array_column($report->errors, 'line'));
        $this->assertSame(3, ExchangeRate::query()->count());
        $this->assertSame('import', ExchangeRate::query()->firstOrFail()->source);
        $this->assertSame('kurs.csv', ExchangeRate::query()->firstOrFail()->source_ref);
        $this->assertTrue($report->hasErrors());
    }

    public function test_csv_import_is_idempotent_and_reports_unchanged_rows(): void {
        $csv = self::HEADER . "\nUSD,IDR,transaction,15500,2026-11-27\nEUR,IDR,transaction,17000,2026-11-27\n";

        $first  = $this->csv()->importString($csv);
        $second = $this->csv()->importString($csv);

        $this->assertSame([2, 0, 0], [$first->created, $first->updated, $first->unchanged]);
        $this->assertSame([0, 0, 2], [$second->created, $second->updated, $second->unchanged]);
        $this->assertFalse($second->hasErrors());
        $this->assertSame(2, ExchangeRate::query()->count());
    }

    public function test_csv_duplicates_inside_the_file_are_reported_on_the_later_line(): void {
        $csv = implode("\n", [
            self::HEADER,
            'USD,IDR,transaction,15500,2026-11-27',
            'USD,IDR,transaction,15600,2026-11-27',   // pasangan/tipe/tanggal sama, nilai beda
            'USD,IDR,transaction,15500,2026-11-27',   // sama persis
            'USD,IDR,closing,15500,2026-11-27',       // tipe lain: bukan duplikat
        ]);

        $report = $this->csv()->importString($csv);

        $this->assertSame(2, $report->created);
        $this->assertSame([3, 4], array_column($report->errors, 'line'));
        $this->assertSame('15500.00000000', ExchangeRate::query()->where('rate_type', 'transaction')->firstOrFail()->rate, 'Kemunculan pertama yang dipakai.');
    }

    public function test_csv_corrects_unreferenced_rates_but_not_referenced_ones(): void {
        $this->makeRate('USD', 'IDR', '15000', '2026-11-27');
        $referenced = $this->makeRate('EUR', 'IDR', '17000', '2026-11-27', referenced: true);

        $csv = implode("\n", [
            self::HEADER,
            'USD,IDR,transaction,15500,2026-11-27',   // belum dirujuk: diubah
            'EUR,IDR,transaction,17500,2026-11-27',   // sudah dirujuk, nilai beda: galat
        ]);

        $report = $this->csv()->importString($csv);

        $this->assertSame(1, $report->updated);
        $this->assertSame([3], array_column($report->errors, 'line'));
        $this->assertSame('15500.00000000', ExchangeRate::query()->where('from_currency_code', 'USD')->firstOrFail()->rate);
        $this->assertSame('17000.00000000', $referenced->refresh()->rate);
    }

    public function test_csv_accepts_any_column_order_bom_semicolons_crlf_and_extra_columns(): void {
        $csv = "\xEF\xBB\xBF" . "rate_date;rate;rate_type;to_currency_code;from_currency_code;catatan\r\n"
            . "2026-11-27;15500;transaction;IDR;USD;dari bank\r\n";

        $report = $this->csv()->importString($csv);

        $this->assertSame(1, $report->created);
        $this->assertFalse($report->hasErrors());
        $rate = ExchangeRate::query()->firstOrFail();
        $this->assertSame(['USD', 'IDR', '15500.00000000'], [$rate->from_currency_code, $rate->to_currency_code, $rate->rate]);
    }

    public function test_csv_with_a_missing_required_header_column_imports_nothing(): void {
        $report = $this->csv()->importString("from_currency_code,to_currency_code,rate\nUSD,IDR,15500\n");

        $this->assertSame(0, $report->created);
        $this->assertSame([1], array_column($report->errors, 'line'));
        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_empty_csv_reports_nothing_and_stores_nothing(): void {
        $report = $this->csv()->importString('');

        $this->assertSame([0, 0, 0], [$report->created, $report->updated, $report->unchanged]);
        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_import_file_reads_from_disk_and_reports_unreadable_files(): void {
        $path = tempnam(sys_get_temp_dir(), 'fx');
        file_put_contents($path, self::HEADER . "\nUSD,IDR,transaction,15500,2026-11-27\n");

        try {
            $report = $this->csv()->importFile($path);
            $this->assertSame(1, $report->created);
            $this->assertSame(basename($path), ExchangeRate::query()->firstOrFail()->source_ref);
        } finally {
            @unlink($path);
        }

        $missing = $this->csv()->importFile($path . '.missing');
        $this->assertTrue($missing->hasErrors());
    }

    public function test_artisan_command_imports_and_exits_non_zero_when_rows_fail(): void {
        $path = tempnam(sys_get_temp_dir(), 'fx');
        file_put_contents($path, self::HEADER . "\nUSD,IDR,transaction,15500,2026-11-27\nUSD,IDR,transaction,0,2026-11-26\n");

        try {
            $this->artisan('finance:import-exchange-rates', ['file' => $path])
                ->expectsOutputToContain('Dibuat: 1')
                ->assertExitCode(1);
        } finally {
            @unlink($path);
        }

        $this->assertSame(1, ExchangeRate::query()->count());
    }

    public function test_artisan_command_succeeds_on_a_clean_file_and_dry_run_stores_nothing(): void {
        $path = tempnam(sys_get_temp_dir(), 'fx');
        file_put_contents($path, self::HEADER . "\nUSD,IDR,transaction,15500,2026-11-27\n");

        try {
            $this->artisan('finance:import-exchange-rates', ['file' => $path, '--dry-run' => true])->assertExitCode(0);
            $this->assertSame(0, ExchangeRate::query()->count(), 'Dry-run tidak boleh menyimpan.');

            $this->artisan('finance:import-exchange-rates', ['file' => $path])->assertExitCode(0);
            $this->assertSame(1, ExchangeRate::query()->count());

            $this->artisan('finance:import-exchange-rates', ['file' => $path])->expectsOutputToContain('tidak berubah: 1')->assertExitCode(0);
        } finally {
            @unlink($path);
        }
    }

    public function test_artisan_command_fails_for_a_missing_file(): void {
        $this->artisan('finance:import-exchange-rates', ['file' => 'tidak-ada.csv'])->assertExitCode(1);
    }

    public function test_unknown_currency_is_rejected_on_every_occurrence_in_a_csv(): void {
        $csv = implode("\n", [
            self::HEADER,
            'XXX,IDR,transaction,1,2026-11-25',
            'XXX,IDR,transaction,1,2026-11-26',
            'XXX,IDR,transaction,1,2026-11-27',
            'USD,IDR,transaction,15500,2026-11-27',
        ]);

        $report = $this->csv()->importString($csv);

        $this->assertSame([2, 3, 4], array_column($report->errors, 'line'));
        $this->assertSame(1, $report->created);
        $this->assertSame(1, ExchangeRate::query()->count());
    }

    public function test_unknown_currency_is_rejected_on_every_manual_store(): void {
        foreach ([1, 2] as $attempt) {
            try {
                $this->manual()->store($this->row(['from_currency_code' => 'XXX']));
                $this->fail("Percobaan {$attempt}: kode tak dikenal harus ditolak.");
            } catch (InvalidExchangeRateException $e) {
                $this->assertArrayHasKey('from_currency_code', $e->errors);
            }
        }
        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_a_currency_created_after_a_failed_lookup_is_accepted(): void {
        $this->expectException(InvalidExchangeRateException::class);
        try {
            $this->manual()->store($this->row(['from_currency_code' => 'GBP']));
        } finally {
            $this->seedCurrencies(['GBP' => 2]);
            $this->assertSame(ExchangeRateRecorder::CREATED, $this->manual()->store($this->row(['from_currency_code' => 'GBP'])));
        }
    }

    public function test_currency_codes_are_normalized_before_every_check(): void {
        // from = to setelah normalisasi.
        try {
            $this->manual()->store($this->row(['from_currency_code' => 'usd', 'to_currency_code' => 'USD']));
            $this->fail('usd -> USD harus ditolak sebagai mata uang yang sama.');
        } catch (InvalidExchangeRateException $e) {
            $this->assertArrayHasKey('to_currency_code', $e->errors);
        }

        // huruf kecil diterima dan disimpan huruf besar.
        $this->manual()->store($this->row(['from_currency_code' => ' usd ', 'to_currency_code' => 'idr']));
        $stored = ExchangeRate::query()->firstOrFail();
        $this->assertSame(['USD', 'IDR'], [$stored->from_currency_code, $stored->to_currency_code]);

        // pencarian baris lama memakai kode ternormalisasi: nilai sama => tidak berubah, bukan baris kedua.
        $this->assertSame(ExchangeRateRecorder::UNCHANGED, $this->manual()->store($this->row()));
        $this->assertSame(1, ExchangeRate::query()->count());
    }

    public function test_case_variants_are_duplicates_inside_a_csv(): void {
        $csv = implode("\n", [
            self::HEADER,
            'USD,IDR,transaction,15500,2026-11-27',
            'usd,idr,transaction,15600,2026-11-27',
            'Usd,IDR,transaction,15500,2026-11-27',
        ]);

        $report = $this->csv()->importString($csv);

        $this->assertSame(1, $report->created);
        $this->assertSame([3, 4], array_column($report->errors, 'line'));
        $this->assertSame(1, ExchangeRate::query()->count());
    }

    public function test_rate_date_is_stored_without_a_time_component(): void {
        $this->manual()->store($this->row());

        $this->assertSame('2026-11-27', DB::table('exchange_rates')->value('rate_date'));
    }

    public function test_correcting_an_unreferenced_rate_writes_an_audit_log_with_the_old_value(): void {
        $this->manual()->store($this->row());
        $rate = ExchangeRate::query()->firstOrFail();

        $this->manual()->store($this->row(['rate' => '15550']));

        $log = Log::query()
            ->where('loggable_type', ExchangeRate::class)
            ->where('loggable_id', $rate->getKey())
            ->where('action', 'updated')
            ->firstOrFail();
        $this->assertSame('15500.00000000', $log->data_before['rate']);
        $this->assertSame('15550.00000000', $log->data_after['rate']);
    }

    public function test_a_unique_violation_on_insert_is_retried_instead_of_failing(): void {
        $inserted = false;
        ExchangeRate::creating(function () use (&$inserted): void {
            if ($inserted) {
                return;
            }
            $inserted = true;
            // Penulis lain menyisipkan kunci yang sama tepat sebelum insert kita.
            DB::table('exchange_rates')->insert([
                'id'                 => (string) Str::ulid(),
                'from_currency_code' => 'USD',
                'to_currency_code'   => 'IDR',
                'rate_type'          => 'transaction',
                'rate'               => '15500',
                'rate_date'          => '2026-11-27',
                'source'             => 'manual',
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        });

        // Pada satu koneksi uji, kegagalan unique menggulung transaksi (termasuk penyisipan "penulis lain"), jadi percobaan
        // ulang menemukan kunci kosong dan membuat baris; yang diuji: pelanggaran unique tidak lolos sebagai galat.
        $outcome = $this->manual()->store($this->row());

        $this->assertSame(ExchangeRateRecorder::CREATED, $outcome);
        $this->assertSame(1, ExchangeRate::query()->count());
    }

    public function test_a_database_error_on_one_row_is_reported_and_the_import_continues(): void {
        $fail = true;
        ExchangeRate::creating(function (ExchangeRate $rate) use (&$fail): void {
            if ($fail && $rate->rate_date->toDateString() === '2026-11-26') {
                $fail = false;

                $previous            = new \PDOException('boom');
                $previous->errorInfo = ['23000', 19, 'boom'];

                throw new QueryException('sqlite', 'insert', [], $previous);
            }
        });

        $report = $this->csv()->importString(implode("\n", [
            self::HEADER,
            'USD,IDR,transaction,15500,2026-11-26',
            'USD,IDR,transaction,15500,2026-11-27',
        ]));

        $this->assertSame([2], array_column($report->errors, 'line'));
        $this->assertSame(1, $report->created);
        $this->assertStringNotContainsString('boom', $report->errors[0]['message']);
    }

    public function test_a_non_constraint_database_error_is_not_swallowed(): void {
        ExchangeRate::creating(function (): void {
            $previous            = new \PDOException('deadlock');
            $previous->errorInfo = ['40001', 1213, 'deadlock'];

            throw new QueryException('mysql', 'insert', [], $previous);
        });

        $this->expectException(QueryException::class);

        $this->csv()->importString(self::HEADER . "\nUSD,IDR,transaction,15500,2026-11-27\n");
    }

    public function test_a_header_with_empty_trailing_cells_is_accepted(): void {
        $report = $this->csv()->importString(self::HEADER . ",,\nUSD,IDR,transaction,15500,2026-11-27,,\n");

        $this->assertFalse($report->hasErrors());
        $this->assertSame(1, $report->created);
    }

    public function test_duplicate_unknown_or_empty_header_columns_do_not_count_as_duplicates(): void {
        $report = $this->csv()->importString(self::HEADER . ",note,note,\nUSD,IDR,transaction,15500,2026-11-27,a,b,\n");

        $this->assertFalse($report->hasErrors());
        $this->assertSame(1, $report->created);
    }

    public function test_many_malformed_lines_are_rejected_quickly_without_a_memory_spike(): void {
        // ~2,6 juta baris rusak ("a") dalam 5 MB: ditolak pada baris ke MAX_ROWS + 1, tanpa memecah seluruh berkas.
        $csv    = self::HEADER . "\n" . str_repeat("a\n", 2_600_000);
        $before = memory_get_peak_usage(true);
        $start  = microtime(true);

        $report = $this->csv()->importString($csv);

        $this->assertSame([0], array_column($report->errors, 'line'));
        $this->assertSame(0, $report->created);
        $this->assertLessThan(5.0, microtime(true) - $start);
        $this->assertLessThan(64 * 1024 * 1024, memory_get_peak_usage(true) - $before);
    }

    public function test_malformed_lines_count_toward_the_row_limit_and_reported_errors_are_capped(): void {
        $over = $this->csv()->importString(self::HEADER . "\n" . str_repeat("a\n", CsvImportProvider::MAX_ROWS + 1));
        $this->assertSame([0], array_column($over->errors, 'line'));

        $csv = self::HEADER . "\n" . str_repeat("a\n", 5000);

        $report = $this->csv()->importString($csv);

        $this->assertCount(RateImportReport::MAX_ERRORS, $report->errors);
        $this->assertSame(5000 - RateImportReport::MAX_ERRORS, $report->omittedErrors);
        $this->assertSame(5000, $report->errorCount());
        $this->assertTrue($report->hasErrors());
    }

    public function test_csv_with_duplicate_header_columns_is_rejected(): void {
        $report = $this->csv()->importString(self::HEADER . ",rate\nUSD,IDR,transaction,15500,2026-11-27,1\n");

        $this->assertSame([1], array_column($report->errors, 'line'));
        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_csv_over_the_size_or_row_limit_is_rejected_entirely(): void {
        $tooBig = $this->csv()->importString(self::HEADER . "\n" . str_repeat('x', CsvImportProvider::MAX_BYTES));
        $this->assertSame([0], array_column($tooBig->errors, 'line'));

        $row     = "USD,IDR,transaction,15500,2026-11-27\n";
        $tooMany = $this->csv()->importString(self::HEADER . "\n" . str_repeat($row, CsvImportProvider::MAX_ROWS + 1));
        $this->assertSame([0], array_column($tooMany->errors, 'line'));
        $this->assertSame(0, ExchangeRate::query()->count());
    }

    public function test_a_file_over_the_size_limit_is_rejected_before_reading(): void {
        $path = tempnam(sys_get_temp_dir(), 'fx');
        file_put_contents($path, str_repeat('a', CsvImportProvider::MAX_BYTES + 1));

        try {
            $report = $this->csv()->importFile($path);
        } finally {
            @unlink($path);
        }

        $this->assertSame([0], array_column($report->errors, 'line'));
    }

    public function test_decimal_comma_is_not_accepted(): void {
        $report = $this->csv()->importString(self::HEADER . "\n" . 'USD,IDR,transaction,"15500,25",2026-11-27' . "\n");

        $this->assertSame([2], array_column($report->errors, 'line'));
        $this->assertSame(0, ExchangeRate::query()->count());
    }
}
