<?php

namespace Database\Seeders;

use App\Models\Core\Country;
use App\Models\Core\Currency;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

class CountrySeeder extends Seeder {
    private function fetchAllCountries(): array {
        $url     = config('services.restcountries.url');
        $key     = config('services.restcountries.key');
        $fields  = 'names.common,codes.alpha_2,languages,flag.url_svg,timezones,currencies,number_format';
        $all     = [];
        $offset  = 0;
        $hasMore = true;

        while ($hasMore) {
            $response = Http::withToken($key)
                ->get($url, [
                    'limit'           => 100,
                    'offset'          => $offset,
                    'response_fields' => $fields,
                ]);

            if ($response->failed()) {
                $this->command->error("REST Countries API error: {$response->status()}");
                break;
            }

            $body    = $response->json('data');
            $objects = $body['objects'] ?? [];
            $all     = array_merge($all, $objects);
            $hasMore = $body['meta']['more'] ?? false;
            $offset += 100;
        }

        return $all;
    }

    private function buildTimezoneMap(): array {
        $map = [];
        $now = new \DateTime('now', new \DateTimeZone('UTC'));

        foreach (\DateTimeZone::listIdentifiers() as $identifier) {
            $tz     = new \DateTimeZone($identifier);
            $offset = $tz->getOffset($now);
            $hours  = intdiv(abs($offset), 3600);
            $mins   = (abs($offset) % 3600) / 60;
            $sign   = $offset >= 0 ? '+' : '-';
            $key    = sprintf('UTC%s%02d:%02d', $sign, $hours, $mins);

            $map[$key][] = $identifier;
        }

        return $map;
    }

    private function deriveNumberFormat(array $numberFormats): ?string {
        $dec  = $numberFormats['decimal_separator'] ?? null;
        $thou = $numberFormats['thousands_separator'] ?? null;

        if ($dec === null) {
            return null;
        }

        return '#' . ($thou ?? '') . '###' . $dec . '##';
    }

    /**
     * Run the database seeds.
     */
    public function run(): void {
        if (app()->isLocal()) {
            Schema::disableForeignKeyConstraints();
            Country::truncate();
            Currency::truncate();
            Schema::enableForeignKeyConstraints();
        }

        $countries   = $this->fetchAllCountries();
        $timezoneMap = $this->buildTimezoneMap();
        $currencies  = [];

        usort($countries, fn ($a, $b) => strcmp(
            $a['names']['common'] ?? '',
            $b['names']['common'] ?? '',
        ));

        foreach ($countries as $country) {
            $code = $country['codes']['alpha_2'] ?? null;

            if (! $code || \strlen($code) !== 2) {
                continue;
            }

            $utcOffsets = $country['timezones'] ?? [];
            $ianaNames  = [];

            foreach ($utcOffsets as $offset) {
                $ianaNames = array_merge($ianaNames, $timezoneMap[$offset] ?? []);
            }

            Country::updateOrCreate(['code' => $code], [
                'name'      => $country['names']['common'] ?? $code,
                'lang_code' => $country['languages'][0]['bcp47'] ?? null,
                'url_flag'  => $country['flag']['url_svg'] ?? null,
                'timezones' => array_unique($ianaNames) ?: null,
            ]);

            $numberFormats = $country['number_format'] ?? [];

            foreach ($country['currencies'] ?? [] as $currency) {
                $currencyCode = $currency['code'] ?? null;

                if (! $currencyCode || \strlen($currencyCode) > 3 || isset($currencies[$currencyCode])) {
                    continue;
                }

                $currencies[$currencyCode] = [
                    'code'          => $currencyCode,
                    'name'          => $currency['name'] ?? $currencyCode,
                    'symbol'        => $currency['symbol'] ?? null,
                    'number_format' => $this->deriveNumberFormat($numberFormats),
                ];
            }
        }

        foreach ($currencies as $currency) {
            Currency::updateOrCreate(['code' => $currency['code']], $currency);
        }

        $this->command->info('Seeded ' . count($countries) . ' countries and ' . count($currencies) . ' currencies.');
    }
}
