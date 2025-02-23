<?php

namespace Database\Seeders;

use App\Models\Core\Country;
use App\Services\CountryApiService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CountrySeeder extends Seeder {
  private function getCountries() {
    try {
      $client = new \GuzzleHttp\Client();
      $response = $client->request('GET', 'https://restcountries.com/v3.1/all?fields=name,cca3');
      $countries = collect(json_decode($response->getBody(), true));
      return $countries->map(fn($country) => ['name' => $country['name']['common'], 'code' => $country['cca3']])->sort(fn($a, $b) => $a['name'] <=> $b['name'])->values();
    } catch (\GuzzleHttp\Exception\BadResponseException  $e) {
      return [];
    }
  }



  /**
   * Run the database seeds.
   */
  public function run(): void {
    Country::truncate();
    Country::insert($this->getCountries()->values()->toArray());
  }
}
