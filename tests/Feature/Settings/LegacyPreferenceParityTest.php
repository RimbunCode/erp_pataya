<?php

namespace Tests\Feature\Settings;

use App\Models\Core\Country;
use App\Models\Core\Preference;
use App\Services\Core\Setting\LegacyPreferenceMap;
use App\Services\Core\Setting\PreferenceMigrator;
use Database\Factories\Core\CurrencyFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * P-2 (Requirement 4.5): untuk data seed `preferences`, peta dari tabel baru
 * setelah migrasi identik (kunci, nilai, tipe) dengan peta dari `preferences`
 * sebelum migrasi.
 */
class LegacyPreferenceParityTest extends TestCase {
    use RefreshDatabase;

    /** Salinan data seed produksi (lihat PreferenceSeeder) ditambah kunci surel dan unik. */
    private function seedLegacyPreferences(): void {
        Country::factory()->create(['code' => 'ID']);
        CurrencyFactory::new()->create(['code' => 'IDR', 'symbol' => 'Rp']);

        $rows = [
            'num_per_page'                   => 100,
            'per_page_options'               => [50, 100, 200, 300],
            'company_name'                   => 'PATAYA',
            'short_name'                     => 'PSN',
            'email'                          => 'pataya@gmail.com',
            'phone'                          => '031-1234567',
            'street'                         => 'Jl. Rungkut Mejoyo Selatan No.9',
            'city'                           => 'Surabaya',
            'state'                          => 'Jawa Timur',
            'zip_code'                       => '60293',
            'country_id'                     => 'ID',
            'bank_name'                      => 'BCA KCU RUNGKUT - SURABAYA',
            'bank_account_name'              => 'PT. PATAYA SARANA NIAGA',
            'bank_account_number'            => '822-2156-228',
            'default_currency_id'            => 'IDR',
            'default_number_format'          => '#.###,##',
            'timezone'                       => 'Asia/Jakarta',
            'tax_invoice_serial_range_start' => 1000,
            'tax_invoice_serial_range_end'   => 2000,
            'tax_invoice_serial_last_used'   => 1500,
            'mail_host'                      => 'smtp.example.test',
            'mail_port'                      => 587,
            'mail_password'                  => 'rahasia',
            'custom_print_label'             => 'Label Khusus',
            'api_key_external'               => 'kunci-rahasia',
        ];

        foreach ($rows as $key => $value) {
            Preference::create(['key' => $key, 'value' => $value]);
        }
    }

    /** @return array<string, mixed> */
    private function oldMap(bool $includeHidden): array {
        $query = Preference::query();
        if ($includeHidden) {
            $query->withoutGlobalScope(Preference::HIDE_PRIVATE_KEYS_SCOPE);
        }

        $map = $query->pluck('value', 'key')->all();
        ksort($map);

        return $map;
    }

    /** @param array<string, mixed> $map
     * @return array<string, mixed>
     */
    private function sorted(array $map): array {
        ksort($map);

        return $map;
    }

    public function test_map_after_migration_is_identical_to_map_before_for_seed_data(): void {
        $this->seedLegacyPreferences();
        $before       = $this->oldMap(includeHidden: true);
        $beforePublic = $this->oldMap(includeHidden: false);

        $report = app(PreferenceMigrator::class)->run();
        $this->assertSame([], $report['invalid']);

        $this->assertSame($before, $this->sorted(LegacyPreferenceMap::build(includeHidden: true)));
        $this->assertSame($beforePublic, $this->sorted(LegacyPreferenceMap::build()));
    }

    public function test_map_is_unchanged_when_migration_runs_twice(): void {
        $this->seedLegacyPreferences();
        app(PreferenceMigrator::class)->run();
        $first = $this->sorted(LegacyPreferenceMap::build(includeHidden: true));

        app(PreferenceMigrator::class)->run();

        $this->assertSame($first, $this->sorted(LegacyPreferenceMap::build(includeHidden: true)));
    }
}
