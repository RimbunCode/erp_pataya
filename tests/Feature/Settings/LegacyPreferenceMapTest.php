<?php

namespace Tests\Feature\Settings;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Core\CoreSetting;
use App\Models\Core\File;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\LegacyPreferenceMap;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LegacyPreferenceMapTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Schema::table('files', function ($table): void {
            foreach (['lft', 'rgt'] as $column) {
                if (! Schema::hasColumn('files', $column)) {
                    $table->unsignedBigInteger($column)->nullable();
                }
            }
            if (! Schema::hasColumn('files', 'depth')) {
                $table->unsignedInteger('depth')->nullable();
            }
        });
    }

    public function test_build_maps_setting_columns_to_legacy_keys_and_omits_nulls(): void {
        FinanceSetting::factory()->create(['tax_invoice_serial_last_used' => 27]);
        SalesSetting::factory()->create(['default_tax_id' => null]);
        CoreSetting::factory()->create([
            'company_name'        => 'Example Corp',
            'company_image_id'    => null,
            'default_currency_id' => null,
        ]);

        $file = File::create([
            'name'      => 'logo',
            'extension' => 'png',
            'path'      => 'company/logo.png',
            'mime_type' => 'image/png',
        ]);

        CoreSetting::current()->update(['company_image_id' => $file->id]);

        $values = LegacyPreferenceMap::build();

        $this->assertSame('Example Corp', $values['company_name']);
        $this->assertSame($file->id, $values['company_image']);
        $this->assertSame(27, $values['tax_invoice_serial_last_used']);
        $this->assertArrayNotHasKey('company_image_id', $values);
        $this->assertArrayNotHasKey('default_currency_id', $values);
    }

    public function test_build_keeps_unknown_keys_and_hides_sensitive_keys_by_default(): void {
        CoreSetting::factory()->create(['mail_password' => 'hidden']);
        Preference::create(['key' => 'custom_print_label', 'value' => 'Special']);
        Preference::create(['key' => 'api_key_external', 'value' => 'hidden']);
        Preference::create(['key' => 'mail_custom_password', 'value' => 'hidden']);

        $visible = LegacyPreferenceMap::build();
        $all     = LegacyPreferenceMap::build(includeHidden: true);

        $this->assertSame('Special', $visible['custom_print_label']);
        $this->assertArrayNotHasKey('api_key_external', $visible);
        $this->assertArrayNotHasKey('mail_password', $visible);
        $this->assertArrayNotHasKey('mail_custom_password', $visible);
        $this->assertSame('hidden', $all['api_key_external']);
        $this->assertSame('hidden', $all['mail_password']);
        $this->assertSame('hidden', $all['mail_custom_password']);
    }

    public function test_snapshot_reports_latest_setting_or_preference_timestamp(): void {
        $core       = CoreSetting::factory()->create();
        $preference = Preference::create(['key' => 'custom_key', 'value' => 'value']);
        $core->forceFill(['updated_at' => now()->subDay()])->saveQuietly();
        $preference->forceFill(['updated_at' => now()])->saveQuietly();

        $snapshot = LegacyPreferenceMap::snapshot();

        $this->assertSame('value', $snapshot['values']['custom_key']);
        $this->assertSame($preference->fresh()->updated_at->toDateTimeString(), $snapshot['updated_at']);
    }

    public function test_build_and_snapshot_reuse_one_read_per_setting_table(): void {
        CoreSetting::factory()->create();
        FinanceSetting::factory()->create();
        SalesSetting::factory()->create();

        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            LegacyPreferenceMap::build();
            LegacyPreferenceMap::snapshot();
            $queries = DB::getQueryLog();
        } finally {
            DB::disableQueryLog();
        }

        foreach (['core_settings', 'finance_settings', 'sales_settings'] as $table) {
            $reads = array_filter($queries, fn (array $query): bool => str_contains($query['query'], '"' . $table . '"'));
            $this->assertCount(1, $reads, $table);
        }
    }

    public function test_snapshot_sees_setting_changes_after_a_memoized_read(): void {
        CoreSetting::factory()->create(['company_name' => 'Original']);
        LegacyPreferenceMap::snapshot();
        app(SettingsService::class)->update(CoreSetting::class, ['company_name' => 'Updated']);

        $this->assertSame('Updated', LegacyPreferenceMap::snapshot()['values']['company_name']);
    }

    public function test_shared_preferences_invalidate_same_second_updates(): void {
        $this->freezeTime();
        CoreSetting::factory()->create(['company_name' => 'Original']);
        $request = Request::create('/');
        $request->setLaravelSession(app('session')->driver());
        $middleware = app(HandleInertiaRequests::class);
        $method     = new \ReflectionMethod($middleware, 'resolveSharedPreferences');
        $first      = $method->invoke($middleware, $request);

        app(SettingsService::class)->update(CoreSetting::class, ['company_name' => 'Updated']);
        $second = $method->invoke($middleware, $request);

        $this->assertSame($first['updated_at'], $second['updated_at']);
        $this->assertSame('Updated', $second['company_name']);
    }
}
