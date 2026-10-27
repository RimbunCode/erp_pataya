<?php

namespace Tests\Feature\Settings;

use App\Models\Core\CoreSetting;
use App\Models\Core\Log;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\User\User;
use App\Services\Core\Setting\PreferenceMigrator;
use App\Services\Core\Setting\SettingsService;
use Database\Seeders\PreferenceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Spec module-settings-foundation Task 8.2 (Requirement 10, P-6).
 * Satu entri audit per update() sukses; nihil pada seeder/migrator.
 */
class ModuleSettingAuditTest extends TestCase {
    use RefreshDatabase;

    public function test_successful_update_creates_exactly_one_audit_entry_with_before_and_after(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $baseline = Log::query()->count();

        app(SettingsService::class)->update(CoreSetting::class, ['company_name' => 'PT Awal']);

        $this->assertSame($baseline + 1, Log::query()->count());

        app(SettingsService::class)->update(CoreSetting::class, [
            'company_name' => 'PT Berubah',
            'timezone'     => 'Asia/Makassar',
        ]);

        $this->assertSame($baseline + 2, Log::query()->count());

        $log = Log::query()->latest('id')->firstOrFail();
        $this->assertSame($user->id, $log->user_id);
        $this->assertSame(CoreSetting::class, $log->loggable_type);
        $this->assertSame('updated', $log->action);
        $this->assertSame('PT Awal', $log->data_before['company_name']);
        $this->assertSame('PT Berubah', $log->data_after['company_name']);
        $this->assertSame('Asia/Jakarta', $log->data_before['timezone']);
        $this->assertSame('Asia/Makassar', $log->data_after['timezone']);
    }

    public function test_noop_update_creates_no_audit_entry(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $baseline = Log::query()->count();

        app(SettingsService::class)->update(CoreSetting::class, ['company_name' => 'PT Sama']);
        app(SettingsService::class)->update(CoreSetting::class, ['company_name' => 'PT Sama']);

        $this->assertSame($baseline + 1, Log::query()->count());
    }

    public function test_seeder_and_data_migration_runs_create_no_setting_audit_entries(): void {
        Preference::create(['key' => 'company_name', 'value' => 'PT Seed']);
        Preference::create(['key' => 'tax_invoice_serial_range_start', 'value' => '5']);

        app(PreferenceSeeder::class)->run();
        app(PreferenceMigrator::class)->run();

        // Requirement 10.3 covers setting changes; other models (Branch, ...)
        // keep the pre-existing DataTable behavior of logging seeder creates.
        $this->assertSame(0, Log::query()->whereIn('loggable_type', [
            CoreSetting::class,
            FinanceSetting::class,
        ])->count());
    }

    public function test_bank_account_number_is_redacted_in_audit(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        app(SettingsService::class)->update(CoreSetting::class, ['bank_account_number' => '822-2156-228']);

        $log = Log::query()->latest('id')->firstOrFail();
        $this->assertSame(CoreSetting::class, $log->loggable_type);
        $this->assertSame('[redacted]', $log->data_after['bank_account_number']);
    }

    public function test_mail_password_changes_are_traceable_without_leaking_the_secret(): void {
        $this->actingAs(User::factory()->create());
        $service = app(SettingsService::class);

        $service->update(CoreSetting::class, ['mail_password' => 'rahasia-pertama']);
        $first = Log::query()->latest('id')->firstOrFail();
        $this->assertSame('[redacted]', $first->data_after['mail_password']);

        $service->update(CoreSetting::class, ['mail_password' => 'rahasia-kedua']);
        $second = Log::query()->latest('id')->firstOrFail();
        $this->assertSame('[redacted]', $second->data_before['mail_password']);
        $this->assertSame('[redacted:changed]', $second->data_after['mail_password']);

        $payload = json_encode([$first->data_before, $first->data_after, $second->data_before, $second->data_after]);
        $this->assertStringNotContainsString('rahasia-pertama', $payload);
        $this->assertStringNotContainsString('rahasia-kedua', $payload);
    }

    public function test_finance_setting_accepts_new_column_via_own_migration(): void {
        // Requirement 11.3: spec Finance menambah kolom lewat migrasi sendiri
        // tanpa perubahan infrastruktur. Kolom contoh hanya hidup di test ini.
        Schema::table('finance_settings', function ($table): void {
            $table->boolean('probe_column')->default(false);
        });

        try {
            $setting = FinanceSetting::current();
            $setting->setAttribute('probe_column', true);
            $setting->save();

            $this->assertTrue((bool) FinanceSetting::current()->refresh()->getAttribute('probe_column'));
        } finally {
            Schema::table('finance_settings', function ($table): void {
                $table->dropColumn('probe_column');
            });
        }
    }
}
