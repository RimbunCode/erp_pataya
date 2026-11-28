<?php

namespace Tests\Feature\Settings;

use App\Models\Core\Log;
use App\Models\Finances\FinanceSetting;
use App\Models\User\User;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 3: setting FX (`fx_max_age_days`, `fx_allow_inverse`) dibuka di halaman Pengaturan Keuangan lewat
 * `FinanceSetting::rules()` (keputusan pemilik produk 28 November 2026) dan tidak lagi ditulis lewat `updateInternal()`.
 */
class FinanceFxSettingsTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidValues(): array {
        return [
            'umur null'          => [['fx_max_age_days' => null], 'fx_max_age_days'],
            'umur negatif'       => [['fx_max_age_days' => -1], 'fx_max_age_days'],
            'umur di atas batas' => [['fx_max_age_days' => 3651], 'fx_max_age_days'],
            'umur bukan angka'   => [['fx_max_age_days' => 'abc'], 'fx_max_age_days'],
            'umur desimal'       => [['fx_max_age_days' => 1.5], 'fx_max_age_days'],
            'inverse null'       => [['fx_allow_inverse' => null], 'fx_allow_inverse'],
            'inverse bukan bool' => [['fx_allow_inverse' => 'abc'], 'fx_allow_inverse'],
        ];
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    #[DataProvider('invalidValues')]
    public function test_invalid_values_are_rejected_and_nothing_changes(array $attributes, string $key): void {
        try {
            app(SettingsService::class)->update(FinanceSetting::class, $attributes);
            $this->fail('Nilai tidak valid harus ditolak.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey($key, $e->errors());
        }

        $setting = FinanceSetting::current()->refresh();
        $this->assertSame(7, $setting->fx_max_age_days);
        $this->assertTrue($setting->fx_allow_inverse);
    }

    public function test_valid_values_are_saved_and_audited(): void {
        $this->actingAs(User::factory()->create());

        $setting = app(SettingsService::class)->update(FinanceSetting::class, ['fx_max_age_days' => 0, 'fx_allow_inverse' => false]);

        $this->assertSame(0, $setting->fx_max_age_days);
        $this->assertFalse($setting->fx_allow_inverse);
        $fresh = FinanceSetting::current()->refresh();
        $this->assertSame(0, $fresh->fx_max_age_days);
        $this->assertFalse($fresh->fx_allow_inverse);

        $log = Log::query()->where('loggable_type', FinanceSetting::class)->latest('id')->firstOrFail();
        $this->assertEquals(7, $log->data_before['fx_max_age_days']);
        $this->assertEquals(0, $log->data_after['fx_max_age_days']);

        app(SettingsService::class)->update(FinanceSetting::class, ['fx_max_age_days' => 3650]);
        $this->assertSame(3650, FinanceSetting::current()->refresh()->fx_max_age_days);
    }

    public function test_fx_settings_are_exposed_by_the_settings_page_rules_and_not_internal(): void {
        foreach (['fx_max_age_days', 'fx_allow_inverse'] as $key) {
            $this->assertArrayHasKey($key, FinanceSetting::rules());
            $this->assertArrayNotHasKey($key, FinanceSetting::internalRules());
        }
    }

    public function test_update_internal_rejects_fx_settings(): void {
        $this->expectException(ValidationException::class);

        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['fx_max_age_days' => 10]);
    }
}
