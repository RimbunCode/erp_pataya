<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\Core\Preference;
use Illuminate\Database\Seeder;

class PreferenceSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        $preferencesArr = [
            'num_per_page'        => 100,
            'per_page_options'    => [
                50,
                100,
                200,
                300,
            ],
            'company_name'        => 'PATAYA',
            'short_name'          => 'PSN',
            'email'               => 'pataya@gmail.com',
            'phone'               => 'asdas',
            'street'              => 'Jl. Rungkut Mejoyo Selatan No.9',
            'city'                => 'Surabaya',
            'state'               => 'Jawa Timur',
            'zip_code'            => '60293',
            'country_id'          => 'IDN',
            'default_currency_id' => 'idr',
            'timezone'            => 'Asia/Jakarta',
        ];
        $preferences    = collect($preferencesArr)->map(fn ($value, $key) => [
            'key'   => $key,
            'value' => $value,
        ])->values();

        foreach ($preferences as $key => $value) {
            Preference::updateOrCreate(['key' => $value['key']], ['value' => $value['value']]);
        }
        Branch::updateOrCreate([
            'code' => $preferencesArr['short_name'],
        ], [
            'name'                => $preferencesArr['company_name'],
            'is_main_branch'      => true,
            'shipping_street'     => $preferencesArr['street'],
            'shipping_city'       => $preferencesArr['city'],
            'shipping_state'      => $preferencesArr['state'],
            'shipping_zip_code'   => $preferencesArr['zip_code'],
            'shipping_country_id' => $preferencesArr['country_id'],
            'billing_address'     => 'same_shipping',
        ]);
    }
}
