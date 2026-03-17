<?php

namespace Database\Seeders;

use App\Models\Core\Country;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\BadResponseException;
use GuzzleHttp\RequestOptions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class CountrySeeder extends Seeder {
    private function getCountries() {
        try {
            $client   = new Client;
            $response = $client->request('GET', 'https://restcountries.com/v3.1/all?fields=name,cca3', [
                RequestOptions::TIMEOUT => 5,
            ]);
            $countries = collect(json_decode($response->getBody(), true));

            return $countries->map(fn ($country) => ['name' => $country['name']['common'], 'code' => $country['cca3']])->sort(fn ($a, $b) => $a['name'] <=> $b['name'])->values();
        } catch (BadResponseException  $e) {
            return [];
        }
    }

    /**
     * Run the database seeds.
     */
    public function run(): void {
        Schema::disableForeignKeyConstraints();
        Country::truncate();
        foreach ($this->getCountries()->values()->toArray() as $country) {
            Country::create($country);
        }
        Schema::enableForeignKeyConstraints();
    }
}
