<?php

namespace Tests\Feature\Core;

use App\Models\Core\Country;
use App\Models\Core\Currency;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CountrySeederTest extends TestCase {
    use RefreshDatabase;

    private function mockApiPage(array $objects, bool $more = false, int $total = 2): void {
        Http::fake([
            'api.restcountries.com/*' => Http::response([
                'data' => [
                    'objects' => $objects,
                    'meta'    => ['total' => $total, 'count' => count($objects), 'limit' => 100, 'offset' => 0, 'more' => $more],
                ],
            ], 200),
        ]);
    }

    private function sampleCountry(string $code = 'ID', string $name = 'Republic of Indonesia'): array {
        return [
            'codes'         => ['alpha_2' => $code],
            'names'         => ['common' => $name],
            'languages'     => [['bcp47' => 'id', 'name' => 'Indonesian']],
            'flag'          => ['url_svg' => 'https://flagcdn.com/id.svg'],
            'timezones'     => ['UTC+07:00'],
            'currencies'    => [['code' => 'IDR', 'name' => 'Indonesian rupiah', 'symbol' => 'Rp']],
            'number_format' => ['decimal_separator' => ',', 'thousands_separator' => '.'],
        ];
    }

    public function test_seeder_creates_country_with_correct_fields(): void {
        $this->mockApiPage([$this->sampleCountry()]);

        $this->seed(CountrySeeder::class);

        $this->assertDatabaseHas('countries', [
            'code'      => 'ID',
            'name'      => 'Republic of Indonesia',
            'lang_code' => 'id',
            'url_flag'  => 'https://flagcdn.com/id.svg',
        ]);

        $country = Country::find('ID');
        $this->assertNotNull($country);
        $this->assertIsArray($country->timezones);
        $this->assertContains('Asia/Jakarta', $country->timezones);
    }

    public function test_seeder_creates_currency_with_symbol_and_number_format(): void {
        $this->mockApiPage([$this->sampleCountry()]);

        $this->seed(CountrySeeder::class);

        $this->assertDatabaseHas('currencies', [
            'code'          => 'IDR',
            'name'          => 'Indonesian rupiah',
            'symbol'        => 'Rp',
            'number_format' => '#.###,##',
        ]);
    }

    public function test_seeder_deduplicates_currencies_across_countries(): void {
        $usdCountry1                  = $this->sampleCountry('US', 'United States of America');
        $usdCountry1['currencies']    = [['code' => 'USD', 'name' => 'US dollar', 'symbol' => '$']];
        $usdCountry1['number_format'] = ['decimal_separator' => '.', 'thousands_separator' => ','];

        $usdCountry2                  = $this->sampleCountry('EC', 'Republic of Ecuador');
        $usdCountry2['currencies']    = [['code' => 'USD', 'name' => 'US dollar', 'symbol' => '$']];
        $usdCountry2['number_format'] = ['decimal_separator' => '.', 'thousands_separator' => ','];

        $this->mockApiPage([$usdCountry1, $usdCountry2]);

        $this->seed(CountrySeeder::class);

        $this->assertSame(1, Currency::where('code', 'USD')->count());
    }

    public function test_seeder_skips_country_without_alpha2_code(): void {
        $invalid = $this->sampleCountry();
        unset($invalid['codes']);

        $this->mockApiPage([
            $invalid,
            $this->sampleCountry('ID', 'Republic of Indonesia'),
        ]);

        $this->seed(CountrySeeder::class);

        $this->assertSame(1, Country::count());
    }

    public function test_seeder_handles_api_error_gracefully(): void {
        Http::fake([
            'api.restcountries.com/*' => Http::response([], 500),
        ]);

        $this->seed(CountrySeeder::class);

        $this->assertSame(0, Country::count());
    }

    public function test_derive_number_format_dot_decimal(): void {
        $usCountry                  = $this->sampleCountry('US', 'United States of America');
        $usCountry['currencies']    = [['code' => 'USD', 'name' => 'US dollar', 'symbol' => '$']];
        $usCountry['number_format'] = ['decimal_separator' => '.', 'thousands_separator' => ','];

        $this->mockApiPage([$usCountry]);
        $this->seed(CountrySeeder::class);

        $this->assertDatabaseHas('currencies', [
            'code'          => 'USD',
            'number_format' => '#,###.##',
        ]);
    }
}
