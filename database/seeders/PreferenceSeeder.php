<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\Core\Preference;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use function GuzzleHttp\json_encode;

class PreferenceSeeder extends Seeder {
  /**
   * Run the database seeds.
   */
  public function run(): void {
    $preferencesArr = [
      "num_per_page" => 100,
      "per_page_options" => [
        50,
        100,
        200,
        300
      ],
      "company_name" => "PATAYA",
      "email" => "pataya@gmail.com",
      "phone" => "asdas",
      "street" => "Jl. Rungkut Mejoyo Selatan No.9",
      "city" => "Surabaya",
      "state" => "Jawa Timur",
      "zip_code" => "60293",
      "country" => "IDN",
      "default_currency" => "idr"
    ];
    $preferences = collect($preferencesArr)->map(fn($value, $key) => [
      'key' => $key,
      'value' => \json_encode($value)
    ])->values();
    Preference::insert($preferences->toArray());
    Branch::create([
      'name' => $preferencesArr['company_name'],
      'is_main_branch' => true,
      'email' => $preferencesArr['email'],
      'phone' => $preferencesArr['phone'],
      'billing_street' => $preferencesArr['street'],
      'billing_city' => $preferencesArr['city'],
      'billing_state' => $preferencesArr['state'],
      'billing_zip' => $preferencesArr['zip_code'],
      'billing_country' => $preferencesArr['country'],
      'shipping_street' => $preferencesArr['street'],
      'shipping_city' => $preferencesArr['city'],
      'shipping_state' => $preferencesArr['state'],
      'shipping_zip' => $preferencesArr['zip_code'],
      'shipping_country' => $preferencesArr['country'],
    ]);
  }
}
