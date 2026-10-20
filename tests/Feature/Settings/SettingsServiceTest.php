<?php

namespace Tests\Feature\Settings;

use App\Events\Core\ModuleSettingUpdated;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Tests\TestCase;

class SettingsServiceTest extends TestCase {
    use RefreshDatabase;

    private SettingsService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new SettingsService;
    }

    public function test_get_returns_memoized_singleton_instance(): void {
        $first  = $this->service->get(CoreSetting::class);
        $second = $this->service->get(CoreSetting::class);

        $this->assertSame($first, $second);
        $this->assertSame(1, CoreSetting::query()->count());
    }

    public function test_get_throws_for_invalid_class(): void {
        $this->expectException(InvalidArgumentException::class);
        $this->service->get(\stdClass::class);
    }

    public function test_update_validates_and_updates_and_dispatches_event(): void {
        Event::fake([ModuleSettingUpdated::class]);

        $setting = $this->service->update(CoreSetting::class, [
            'company_name' => 'PT Maju Bersama',
            'timezone'     => 'Asia/Makassar',
            'num_per_page' => 50,
        ]);

        $this->assertSame('PT Maju Bersama', $setting->company_name);
        $this->assertSame('Asia/Makassar', $setting->timezone);
        $this->assertSame(50, $setting->num_per_page);
        $this->assertSame('PT Maju Bersama', CoreSetting::current()->company_name);

        Event::assertDispatched(ModuleSettingUpdated::class, function ($event) {
            return $event->setting instanceof CoreSetting
                && $event->attributes['company_name'] === 'PT Maju Bersama';
        });
    }

    public function test_update_rejects_unknown_attributes(): void {
        $this->expectException(ValidationException::class);

        $this->service->update(CoreSetting::class, [
            'company_name'        => 'Valid Name',
            'non_existent_column' => 'Malicious payload',
        ]);
    }

    public function test_nested_page_options_are_validated_before_any_changes(): void {
        CoreSetting::factory()->create(['company_name' => 'Original', 'per_page_options' => [25, 50]]);
        try {
            $this->service->update(CoreSetting::class, ['company_name' => 'Changed', 'per_page_options' => [25, -1]]);
            $this->fail('Invalid page options must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('per_page_options.1', $exception->errors());
            $this->assertSame('Original', CoreSetting::current()->company_name);
            $this->assertSame([25, 50], CoreSetting::current()->per_page_options);
        }
    }

    public function test_prohibited_attribute_message_identifies_the_attribute(): void {
        try {
            $this->service->update(CoreSetting::class, ['unknown_setting' => 'value']);
            $this->fail('Unknown attribute must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertStringContainsString('unknown_setting', $exception->errors()['unknown_setting'][0]);
            $this->assertStringNotContainsString(':attribute', $exception->errors()['unknown_setting'][0]);
        }
    }

    public function test_updated_event_redacts_hidden_password_attributes(): void {
        Event::fake([ModuleSettingUpdated::class]);
        $this->service->update(CoreSetting::class, ['mail_password' => 'synthetic-password']);

        Event::assertDispatched(ModuleSettingUpdated::class, fn (ModuleSettingUpdated $event): bool => ($event->attributes['mail_password'] ?? null) === '[redacted]');
    }

    public function test_update_p5_rejects_invalid_timezone_and_does_not_partial_apply(): void {
        $original = CoreSetting::current();
        $original->update(['company_name' => 'Original Name']);

        try {
            $this->service->update(CoreSetting::class, [
                'company_name' => 'Should Not Persist',
                'timezone'     => 'Invalid/Timezone_Name',
            ]);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException) {
            $current = CoreSetting::current();
            $this->assertSame('Original Name', $current->company_name);
        }
    }

    public function test_update_derives_default_number_format_from_currency(): void {
        Currency::create([
            'code'          => 'IDR',
            'name'          => 'Indonesian Rupiah',
            'symbol'        => 'Rp',
            'number_format' => '#.###,##',
        ]);

        $setting = $this->service->update(CoreSetting::class, [
            'default_currency_id' => 'idr',
            'timezone'            => 'Asia/Jakarta',
            'num_per_page'        => 25,
        ]);

        $this->assertSame('IDR', $setting->default_currency_id);
        $this->assertSame('#.###,##', $setting->default_number_format);
    }

    public function test_locked_current_ensures_row_exists_outside_transaction(): void {
        $this->service->lockedCurrent(FinanceSetting::class);

        $this->assertSame(1, FinanceSetting::query()->count());
        $this->assertSame(0, FinanceSetting::current()->tax_invoice_serial_last_used);
    }

    public function test_locked_current_inside_transaction_acquires_lock_and_allows_update(): void {
        DB::transaction(function (): void {
            $finance = $this->service->lockedCurrent(FinanceSetting::class);
            $this->assertInstanceOf(FinanceSetting::class, $finance);
            $this->assertSame(0, $finance->tax_invoice_serial_last_used);
            $finance->tax_invoice_serial_last_used = 15;
            $finance->save();
        });

        $this->assertSame(15, FinanceSetting::current()->tax_invoice_serial_last_used);
    }
}
