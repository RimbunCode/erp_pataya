<?php

namespace Database\Seeders;

use App\Models\Core\Branch;
use App\Models\Core\CoreSetting;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Finances\FinanceSetting;
use App\Models\Sales\SalesSetting;
use Illuminate\Database\Seeder;

class PreferenceSeeder extends Seeder {
    /**
     * Run the database seeds.
     */
    public function run(): void {
        $preferencesArr = [
            'num_per_page'     => 100,
            'per_page_options' => [
                50,
                100,
                200,
                300,
            ],
            'company_name'          => 'PATAYA',
            'short_name'            => 'PSN',
            'email'                 => 'pataya@gmail.com',
            'phone'                 => 'asdas',
            'street'                => 'Jl. Rungkut Mejoyo Selatan No.9',
            'city'                  => 'Surabaya',
            'state'                 => 'Jawa Timur',
            'zip_code'              => '60293',
            'country_id'            => 'ID',
            'bank_name'             => 'BCA KCU RUNGKUT - SURABAYA',
            'bank_account_name'     => 'PT. PATAYA SARANA NIAGA',
            'bank_account_number'   => '822-2156-228',
            'default_currency_id'   => 'IDR',
            'default_number_format' => '#.###,##',
            'timezone'              => 'Asia/Jakarta',
            // Range nomor seri Faktur Pajak yang dialokasikan DJP -- diisi manual oleh admin
            // sesuai alokasi resmi, BUKAN di-generate bebas oleh sistem (Requirement 7.3).
            // Kolom preferences.value NOT NULL, jadi 0 (bukan null) dipakai sebagai sentinel
            // "belum dikonfigurasi" -- range asli DJP selalu mulai dari angka positif >= 1,
            // jadi 0 tidak bentrok dengan nilai valid manapun.
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
        ];
        // FK nyata: hanya tanam kode negara/mata uang bila baris acuannya
        // sudah ada (CountrySeeder berjalan setelah seeder ini dan butuh API
        // eksternal). Kalau belum ada, biarkan null daripada menggagalkan
        // seluruh seed instalasi baru.
        $countryId = Country::where('code', $preferencesArr['country_id'])->exists()
            ? $preferencesArr['country_id']
            : null;
        $currencyId = Currency::where('code', $preferencesArr['default_currency_id'])->exists()
            ? $preferencesArr['default_currency_id']
            : null;

        CoreSetting::updateOrCreate(['singleton' => true], [
            'company_name'          => $preferencesArr['company_name'],
            'short_name'            => $preferencesArr['short_name'],
            'email'                 => $preferencesArr['email'],
            'phone'                 => $preferencesArr['phone'],
            'street'                => $preferencesArr['street'],
            'city'                  => $preferencesArr['city'],
            'state'                 => $preferencesArr['state'],
            'zip_code'              => $preferencesArr['zip_code'],
            'country_id'            => $countryId,
            'bank_name'             => $preferencesArr['bank_name'],
            'bank_account_name'     => $preferencesArr['bank_account_name'],
            'bank_account_number'   => $preferencesArr['bank_account_number'],
            'default_currency_id'   => $currencyId,
            'default_number_format' => $preferencesArr['default_number_format'],
            'timezone'              => $preferencesArr['timezone'],
            'num_per_page'          => $preferencesArr['num_per_page'],
            'per_page_options'      => $preferencesArr['per_page_options'],
        ]);
        FinanceSetting::updateOrCreate(['singleton' => true], [
            'tax_invoice_serial_range_start' => $preferencesArr['tax_invoice_serial_range_start'],
            'tax_invoice_serial_range_end'   => $preferencesArr['tax_invoice_serial_range_end'],
            'tax_invoice_serial_last_used'   => $preferencesArr['tax_invoice_serial_last_used'],
        ]);
        SalesSetting::firstOrCreate(['singleton' => true]);

        Branch::firstOrCreate([
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
