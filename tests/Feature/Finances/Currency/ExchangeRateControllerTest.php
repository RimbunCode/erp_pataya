<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Http\Controllers\Finances\ExchangeRateController;
use App\Models\Core\Log;
use App\Models\Finances\ExchangeRate;
use App\Models\User\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 3.1 (Requirement 1.2-1.5): `ExchangeRateController` (daftar, tambah, koreksi, impor CSV) beserta
 * otorisasi per aksi (`select`, `write`, `import`). Aturan domain kurs sudah diuji di test Task 2; di sini yang diuji
 * adalah pagar izin, bentuk masukan, dan pemetaan galat domain menjadi galat validasi (422).
 */
class ExchangeRateControllerTest extends TestCase {
    use BuildsFinanceFixtures, CreatesExchangeRates, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([ExchangeRate::class]);
        $this->seedCurrencies();
    }

    /**
     * @param  list<string>  $permissions
     */
    private function actingWith(array $permissions): static {
        $flags = array_fill_keys($permissions, true);

        return $this->withSession([
            'permissions' => [
                ExchangeRate::class => [0 => [['model' => ExchangeRate::class, 'level' => 0, 'only_creator' => false, 'permissions' => $flags]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array {
        return array_merge([
            'from_currency_code' => 'USD',
            'to_currency_code'   => 'IDR',
            'rate_type'          => 'transaction',
            'rate'               => '15800.5',
            'rate_date'          => '2026-11-20',
        ], $overrides);
    }

    private function csv(string ...$lines): string {
        return implode("\n", ['from_currency_code,to_currency_code,rate_type,rate,rate_date', ...$lines]) . "\n";
    }

    private function upload(string $content, string $name = 'rates.csv'): UploadedFile {
        return UploadedFile::fake()->createWithContent($name, $content);
    }

    public function test_index_requires_select_and_exposes_action_flags(): void {
        $this->actingWith(['read'])->get(route('exchangeRates.index'))->assertForbidden();

        $this->actingWith(['select'])->get(route('exchangeRates.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/ExchangeRates/Index')
                ->where('canWrite', false)
                ->where('canImport', false)
                ->where('canDelete', false)
                ->where('rateTypes', RateType::values())
                ->where('importMaxMb', 5));

        $this->actingWith(['select', 'write', 'import', 'delete'])->get(route('exchangeRates.index'))
            ->assertInertia(fn ($page) => $page->where('canWrite', true)->where('canImport', true)->where('canDelete', true));
    }

    public function test_save_requires_write_permission(): void {
        $this->actingWith(['select', 'read', 'import'])->post(route('exchangeRates.save'), $this->payload())->assertForbidden();

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_save_creates_a_manual_rate_recording_the_user(): void {
        $this->actingWith(['select', 'write'])->post(route('exchangeRates.save'), $this->payload())
            ->assertRedirect()
            ->assertSessionHas('success');

        $rate = ExchangeRate::firstOrFail();
        $this->assertSame('USD', $rate->from_currency_code);
        $this->assertSame('15800.50000000', $rate->rate);
        $this->assertSame(ExchangeRate::SOURCE_MANUAL, $rate->source);
        $this->assertNull($rate->source_ref);
        $this->assertSame($this->user->getKey(), $rate->created_by_id);
        $this->assertSame('2026-11-20', $rate->rate_date->toDateString());
    }

    public function test_save_normalizes_currency_codes(): void {
        $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload(['from_currency_code' => ' usd ']))->assertRedirect();

        $this->assertSame('USD', ExchangeRate::firstOrFail()->from_currency_code);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidPayloads(): array {
        return [
            'mata uang tak dikenal'   => [['from_currency_code' => 'ZZZ'], 'from_currency_code'],
            'mata uang sama'          => [['to_currency_code' => 'USD'], 'to_currency_code'],
            'kurs nol'                => [['rate' => '0'], 'rate'],
            'kurs desimal koma'       => [['rate' => '15500,25'], 'rate'],
            'kurs lebih 8 desimal'    => [['rate' => '1.123456789'], 'rate'],
            'tanggal tak ada'         => [['rate_date' => '2026-02-30'], 'rate_date'],
            'tipe tak dikenal'        => [['rate_type' => 'forward'], 'rate_type'],
            'kolom wajib kosong'      => [['rate' => ''], 'rate'],
            'kolom di luar rancangan' => [['source' => 'import'], 'source'],
            'pembuat dari input'      => [['created_by_id' => 'x'], 'created_by_id'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('invalidPayloads')]
    public function test_save_rejects_invalid_input(array $overrides, string $errorKey): void {
        $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload($overrides))
            ->assertSessionHasErrors($errorKey);

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_save_rejects_an_existing_pair_type_and_date_pointing_to_the_correct_action(): void {
        $existing = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        foreach (['15100', '15000'] as $rate) {
            $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload(['rate' => $rate, 'from_currency_code' => ' usd ']))
                ->assertSessionHasErrors(['rate_date' => __('finances/exchangeRate.errors.already_exists')]);
        }

        $this->assertSame('15000.00000000', $existing->refresh()->rate);
        $this->assertSame(1, ExchangeRate::count());
    }

    public function test_save_rejects_an_existing_referenced_key_too_and_allows_other_dates_and_types(): void {
        $existing = $this->makeRate('USD', 'IDR', '15000', '2026-11-20', referenced: true);

        $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload(['rate' => '15100']))->assertSessionHasErrors('rate_date');
        $this->assertSame('15000.00000000', $existing->refresh()->rate);

        $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload(['rate_date' => '2026-11-21']))->assertSessionHasNoErrors();
        $this->actingWith(['write'])->post(route('exchangeRates.save'), $this->payload(['rate_type' => 'closing']))->assertSessionHasNoErrors();
        $this->assertSame(3, ExchangeRate::count());
    }

    public function test_remove_requires_delete_permission(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        $this->actingWith(['select', 'read', 'write', 'import'])->delete(route('exchangeRates.remove', $rate))->assertForbidden();

        $this->assertSame(1, ExchangeRate::count());
    }

    public function test_remove_deletes_an_unreferenced_rate_and_records_the_deleted_values_in_the_audit_log(): void {
        $rate  = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');
        $other = $this->makeRate('EUR', 'IDR', '17000', '2026-11-20');

        $this->actingWith(['delete'])->delete(route('exchangeRates.remove', $rate))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNull(ExchangeRate::find($rate->id));
        $this->assertNotNull(ExchangeRate::find($other->id));

        $log = Log::query()->where('loggable_type', ExchangeRate::class)->where('loggable_id', $rate->id)->where('action', 'deleted')->firstOrFail();
        $this->assertSame('USD', $log->data_before['from_currency_code']);
        $this->assertSame('2026-11-20', $log->data_before['rate_date']);
        $this->assertEquals(15000, $log->data_before['rate']);
        $this->assertSame($this->user->getKey(), $log->user_id);
    }

    public function test_remove_rejects_a_referenced_rate(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20', referenced: true);

        $this->actingWith(['delete'])->delete(route('exchangeRates.remove', $rate))->assertSessionHasErrors('rate');

        $this->assertNotNull(ExchangeRate::find($rate->id));
        $this->assertSame(0, Log::query()->where('action', 'deleted')->where('loggable_type', ExchangeRate::class)->count());
    }

    public function test_the_delete_permission_is_registered_for_the_model(): void {
        ExchangeRate::initPermissions();

        $permission = Permission::where('model', ExchangeRate::class)->firstOrFail();
        foreach (['select', 'read', 'write', 'delete', 'import'] as $action) {
            $this->assertContains($action, $permission->permissions);
        }
    }

    public function test_import_still_upserts_existing_keys_and_reports_them_as_updated(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        $response = $this->actingWith(['import'])->post(route('exchangeRates.import'), ['file' => $this->upload($this->csv('USD,IDR,transaction,15100,2026-11-20'))]);

        $this->assertSame('15100.00000000', $rate->refresh()->rate);
        $this->assertSame(1, $response->getSession()->get('importReport')['updated']);
    }

    public function test_correct_requires_write_permission(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        $this->actingWith(['select', 'read', 'import'])->put(route('exchangeRates.correct', $rate), ['rate' => '15100'])->assertForbidden();

        $this->assertSame('15000.00000000', $rate->refresh()->rate);
    }

    public function test_correct_updates_only_the_rate_of_the_row_in_the_url(): void {
        $rate  = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');
        $other = $this->makeRate('EUR', 'IDR', '17000', '2026-11-20');

        $this->actingWith(['write'])->put(route('exchangeRates.correct', $rate), ['rate' => '15250.25'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('15250.25000000', $rate->refresh()->rate);
        $this->assertSame('17000.00000000', $other->refresh()->rate);
        $this->assertSame(2, ExchangeRate::count());
    }

    public function test_correct_rejects_a_referenced_rate(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20', referenced: true);

        $this->actingWith(['write'])->put(route('exchangeRates.correct', $rate), ['rate' => '15250'])
            ->assertSessionHasErrors('rate');

        $this->assertSame('15000.00000000', $rate->refresh()->rate);
    }

    public function test_correct_does_not_accept_pair_type_or_date_from_input(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        $this->actingWith(['write'])->put(route('exchangeRates.correct', $rate), ['rate' => '15100', 'to_currency_code' => 'EUR'])
            ->assertSessionHasErrors('to_currency_code');

        $this->assertSame('15000.00000000', $rate->refresh()->rate);
        $this->assertSame('IDR', $rate->to_currency_code);
    }

    public function test_correct_rejects_invalid_rate_values(): void {
        $rate = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');

        $this->actingWith(['write'])->put(route('exchangeRates.correct', $rate), ['rate' => '-5'])->assertSessionHasErrors('rate');
        $this->assertSame('15000.00000000', $rate->refresh()->rate);
    }

    public function test_import_requires_import_permission_even_with_write(): void {
        $this->actingWith(['select', 'read', 'write'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload($this->csv('USD,IDR,transaction,15500,2026-11-20'))])
            ->assertForbidden();

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_import_reads_an_uploaded_csv_and_reports_errors_per_line(): void {
        $csv = $this->csv(
            'USD,IDR,transaction,15500.5,2026-11-20',
            'EUR,IDR,transaction,17000,2026-11-20',
            'ZZZ,IDR,transaction,1,2026-11-20',
            'USD,IDR,transaction,15500.5,2026-11-20',
            'USD,IDR,transaction,abc,2026-11-21',
        );

        $response = $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload($csv, 'kurs-bi.csv')])
            ->assertRedirect();

        $this->assertSame(2, ExchangeRate::count());
        $usd = ExchangeRate::where('from_currency_code', 'USD')->firstOrFail();
        $this->assertSame(ExchangeRate::SOURCE_IMPORT, $usd->source);
        $this->assertSame('kurs-bi.csv', $usd->source_ref);
        $this->assertSame($this->user->getKey(), $usd->created_by_id);

        $report = $response->getSession()->get('importReport');
        $this->assertSame(2, $report['created']);
        $this->assertSame(3, $report['errorCount']);
        $this->assertSame([4, 5, 6], array_column($report['errors'], 'line'));
    }

    public function test_import_is_idempotent_for_the_same_file(): void {
        $csv = $this->csv('USD,IDR,transaction,15500,2026-11-20');

        $this->actingWith(['import'])->post(route('exchangeRates.import'), ['file' => $this->upload($csv)]);
        $response = $this->actingWith(['import'])->post(route('exchangeRates.import'), ['file' => $this->upload($csv)]);

        $this->assertSame(1, ExchangeRate::count());
        $this->assertSame(1, $response->getSession()->get('importReport')['unchanged']);
    }

    public function test_import_reports_a_missing_header_without_writing(): void {
        $response = $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload("a,b,c\n1,2,3\n")])
            ->assertRedirect();

        $this->assertSame(0, ExchangeRate::count());
        $this->assertSame(1, $response->getSession()->get('importReport')['errorCount']);
    }

    public function test_import_of_an_empty_file_reports_an_error(): void {
        $response = $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload("  \n")])
            ->assertRedirect();

        $this->assertSame(1, $response->getSession()->get('importReport')['errorCount']);
    }

    public function test_row_action_attributes_stay_in_rows_even_when_their_columns_are_hidden(): void {
        $this->makeRate('USD', 'IDR', '15000', '2026-11-20');
        $this->makeRate('EUR', 'IDR', '17000', '2026-11-20', referenced: true);

        // Hanya kolom `source` yang tampil: aksi Koreksi tetap butuh pasangan, tipe, tanggal, rate, dan canDelete.
        $rows = collect($this->actingWith(['select'])
            ->withUnencryptedCookie('datatable_columns_exchange_rates', json_encode(['source' => ['width' => 100]]))
            ->getJson(route('exchangeRates.index'), ['X-Inertia' => 'true'])
            ->assertOk()
            ->json('props.data.data'))->keyBy('from_currency_code');

        $this->assertCount(2, $rows);
        $this->assertEquals(15000, $rows['USD']['rate']);
        $this->assertSame('IDR', $rows['USD']['to_currency_code']);
        $this->assertSame('transaction', $rows['USD']['rate_type']);
        $this->assertStringStartsWith('2026-11-20', (string) $rows['USD']['rate_date']);
        $this->assertTrue($rows['USD']['canDelete']);
        $this->assertFalse($rows['EUR']['canDelete']);
    }

    public function test_import_requires_an_uploaded_file(): void {
        $this->actingWith(['import'])->post(route('exchangeRates.import'), [])->assertSessionHasErrors('file');
        $this->actingWith(['import'])->post(route('exchangeRates.import'), ['file' => 'rates.csv'])->assertSessionHasErrors('file');
    }

    public function test_import_never_accepts_a_server_path_from_input(): void {
        $path = tempnam(sys_get_temp_dir(), 'rates');
        file_put_contents($path, $this->csv('USD,IDR,transaction,15500,2026-11-20'));

        $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload($this->csv('EUR,IDR,transaction,17000,2026-11-20')), 'path' => $path])
            ->assertSessionHasErrors('path');
        $this->actingWith(['import'])->post(route('exchangeRates.import'), ['path' => $path])->assertSessionHasErrors('file');
        @unlink($path);

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_import_rejects_oversized_and_wrong_type_uploads(): void {
        $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => UploadedFile::fake()->create('big.csv', 5 * 1024 + 1)])
            ->assertSessionHasErrors('file');
        $this->actingWith(['import'])
            ->post(route('exchangeRates.import'), ['file' => $this->upload('x', 'rates.php')])
            ->assertSessionHasErrors('file');

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_import_stores_a_sanitized_source_ref(): void {
        $this->actingWith(['import'])->post(route('exchangeRates.import'), [
            'file' => $this->upload($this->csv('USD,IDR,transaction,15500,2026-11-20'), '=HYPERLINK("x").csv'),
        ])->assertRedirect();

        $this->assertSame('HYPERLINK("x").csv', ExchangeRate::firstOrFail()->source_ref);
    }

    /**
     * @return array<string, array{0: string|null, 1: string}>
     */
    public static function sourceRefCases(): array {
        return [
            'nama biasa'           => ['kurs.csv', 'kurs.csv'],
            'path unix'            => ['../../etc/kurs.csv', 'kurs.csv'],
            'path windows'         => ['C:\\Users\\a\\kurs.csv', 'kurs.csv'],
            'awalan rumus ='       => ['=cmd|calc.csv', 'cmd|calc.csv'],
            'awalan rumus +-@'     => ['+-@  =x.csv', 'x.csv'],
            'karakter kontrol'     => ["ku\x00rs\n.csv\x1F", 'kurs.csv'],
            'awalan tab'           => ["\t=x.csv", 'x.csv'],
            'hanya karakter rumus' => ['=+-@', 'import.csv'],
            'kosong'               => ['', 'import.csv'],
            'null'                 => [null, 'import.csv'],
            'utf8 rusak'           => ["a\xFFb.csv", 'a?b.csv'],
        ];
    }

    #[DataProvider('sourceRefCases')]
    public function test_source_ref_sanitizer(?string $name, string $expected): void {
        $this->assertSame($expected, ExchangeRateController::sanitizeSourceRef($name));
    }

    public function test_source_ref_is_capped_to_200_characters(): void {
        $this->assertSame(200, mb_strlen(ExchangeRateController::sanitizeSourceRef(str_repeat('é', 300) . '.csv')));
    }
}
