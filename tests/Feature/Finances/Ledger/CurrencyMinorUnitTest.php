<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Core\Currency;
use App\Services\Finances\Ledger\Iso4217;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Finance Fase 1, Requirement 7 (keputusan Q-P1-4, 2026-11-04): `minor_unit` dan kode numerik ISO 4217 lengkap, statis
 * dan idempoten, diisi oleh migration (baris yang sudah ada) dan `CountrySeeder` (baris yang di-seed kemudian).
 */
class CurrencyMinorUnitTest extends TestCase {
    use RefreshDatabase;

    public function test_iso_table_is_well_formed(): void {
        $numericCodes = [];
        foreach (Iso4217::all() as $code => [$numeric, $minorUnit]) {
            $this->assertMatchesRegularExpression('/^[A-Z]{3}$/', $code);
            $this->assertMatchesRegularExpression('/^\d{3}$/', $numeric, "Kode numerik {$code}");
            $this->assertContains($minorUnit, [0, 2, 3, 4], "Minor unit {$code}");
            $numericCodes[$numeric][] = $code;
        }

        // Satu-satunya kode numerik ganda: ANG (ditarik) dan penggantinya XCG.
        $duplicates = array_filter($numericCodes, fn (array $codes) => \count($codes) > 1);
        $this->assertSame(['532' => ['ANG', 'XCG']], $duplicates);
    }

    /**
     * @return array<string, array{0: string, 1: int, 2: string|null}>
     */
    public static function knownCurrencies(): array {
        return [
            'IDR' => ['IDR', 2, '360'], 'USD' => ['USD', 2, '840'], 'JPY' => ['JPY', 0, '392'], 'KRW' => ['KRW', 0, '410'],
            'KWD' => ['KWD', 3, '414'], 'BHD' => ['BHD', 3, '048'], 'OMR' => ['OMR', 3, '512'], 'TND' => ['TND', 3, '788'],
            'JOD' => ['JOD', 3, '400'], 'IQD' => ['IQD', 3, '368'], 'LYD' => ['LYD', 3, '434'], 'CLF' => ['CLF', 4, '990'],
            'UYW' => ['UYW', 4, '927'], 'CLP' => ['CLP', 0, '152'], 'ISK' => ['ISK', 0, '352'], 'UGX' => ['UGX', 0, '800'],
            'VND' => ['VND', 0, '704'], 'XOF' => ['XOF', 0, '952'], 'XAF' => ['XAF', 0, '950'], 'XPF' => ['XPF', 0, '953'],
        ];
    }

    #[DataProvider('knownCurrencies')]
    public function test_known_currencies_have_the_standard_minor_unit(string $code, int $minorUnit, string $numeric): void {
        $this->assertSame($minorUnit, Iso4217::minorUnit($code));
        $this->assertSame($numeric, Iso4217::numericCode($code));
        $this->assertSame($minorUnit, Iso4217::minorUnit(strtolower($code)));
    }

    public function test_unknown_codes_default_to_two_without_numeric_code(): void {
        $this->assertSame(2, Iso4217::minorUnit('GGP'));
        $this->assertNull(Iso4217::numericCode('GGP'));
    }

    public function test_migration_fills_minor_units_for_existing_rows_idempotently(): void {
        foreach (['JPY', 'KWD', 'CLF', 'IDR', 'GGP'] as $code) {
            Currency::create(['code' => $code, 'name' => $code]);
        }

        $migration = require base_path('database/migrations/2026_11_04_100006_add_minor_unit_to_currencies_table.php');
        $migration->up();
        $migration->up();

        $this->assertSame([0, '392'], $this->unit('JPY'));
        $this->assertSame([3, '414'], $this->unit('KWD'));
        $this->assertSame([4, '990'], $this->unit('CLF'));
        $this->assertSame([2, '360'], $this->unit('IDR'));
        $this->assertSame([2, null], $this->unit('GGP'), 'Kode non-ISO tetap 2 tanpa kode numerik.');
    }

    public function test_country_seeder_sets_minor_unit_and_numeric_code(): void {
        $country = fn (string $code, string $currency) => [
            'codes'         => ['alpha_2' => $code],
            'names'         => ['common' => $code],
            'languages'     => [],
            'flag'          => [],
            'timezones'     => [],
            'currencies'    => [['code' => $currency, 'name' => $currency, 'symbol' => $currency]],
            'number_format' => [],
        ];
        Http::fake(['api.restcountries.com/*' => Http::response(['data' => [
            'objects' => [$country('JP', 'JPY'), $country('KW', 'KWD'), $country('GG', 'GGP')],
            'meta'    => ['total' => 3, 'count' => 3, 'limit' => 100, 'offset' => 0, 'more' => false],
        ]], 200)]);

        $this->seed(CountrySeeder::class);

        $this->assertSame([0, '392'], $this->unit('JPY'));
        $this->assertSame([3, '414'], $this->unit('KWD'));
        $this->assertSame([2, null], $this->unit('GGP'));
    }

    /**
     * @return array{0: int, 1: string|null}
     */
    private function unit(string $code): array {
        $row = Currency::query()->whereKey($code)->firstOrFail();

        return [(int) $row->minor_unit, $row->numeric_code];
    }
}
