<?php

namespace Database\Seeders;

use App\Models\Core\Currency;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;

class CurrencySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $response = Http::get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.min.json');
        $currencies = $response->json();

        foreach ($currencies as $key => $currencyName) {
            Currency::create([
                'code' => $key,
                'name' => $currencyName,
            ]);
        }
    }
}
