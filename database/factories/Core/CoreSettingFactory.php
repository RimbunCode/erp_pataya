<?php

namespace Database\Factories\Core;

use App\Models\Core\CoreSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CoreSetting>
 */
class CoreSettingFactory extends Factory {
    protected $model = CoreSetting::class;

    public function definition(): array {
        return [
            'singleton'             => true,
            'company_name'          => 'PT Test Company',
            'short_name'            => 'TTC',
            'email'                 => 'test@company.local',
            'phone'                 => '021-12345678',
            'street'                => 'Jl. Uji Coba No. 1',
            'city'                  => 'Jakarta',
            'state'                 => 'DKI Jakarta',
            'zip_code'              => '12345',
            'country_id'            => null,
            'bank_name'             => 'BCA',
            'bank_account_name'     => 'PT Test Company',
            'bank_account_number'   => '1234567890',
            'default_currency_id'   => null,
            'default_number_format' => '#.###,##',
            'timezone'              => 'Asia/Jakarta',
            'num_per_page'          => 25,
            'per_page_options'      => [25, 50, 100],
            'company_image_id'      => null,
        ];
    }
}
