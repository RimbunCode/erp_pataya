<?php

namespace Tests\Feature\Settings;

use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\PreferenceMigrator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PreferenceMigratorTest extends TestCase {
    use RefreshDatabase;

    public function test_migrates_typed_values_and_unknown_keys_without_deleting_preferences(): void {
        Preference::create(['key' => 'tax_invoice_serial_range_start', 'value' => '100']);
        Preference::create(['key' => 'tax_invoice_serial_range_end', 'value' => '200']);
        Preference::create(['key' => 'tax_invoice_serial_last_used', 'value' => '100']);
        Preference::create(['key' => 'num_per_page', 'value' => '50']);
        Preference::create(['key' => 'per_page_options', 'value' => '[50,"100"]']);
        Preference::create(['key' => 'unknown_option', 'value' => 'keep']);

        $report = app(PreferenceMigrator::class)->run();

        $finance = FinanceSetting::current();
        $this->assertSame(100, $finance->tax_invoice_serial_range_start);
        $this->assertSame(200, $finance->tax_invoice_serial_range_end);
        $this->assertSame(100, $finance->tax_invoice_serial_last_used);
        $this->assertContains('unknown_option', $report['unknown_keys']);
        $this->assertSame(6, Preference::query()->count());
    }

    public function test_migration_is_idempotent_and_force_overwrites_existing_value(): void {
        FinanceSetting::factory()->create(['tax_invoice_serial_range_start' => 999]);
        Preference::create(['key' => 'tax_invoice_serial_range_start', 'value' => '100']);

        $first = app(PreferenceMigrator::class)->run();
        $this->assertContains('tax_invoice_serial_range_start', $first['skipped_existing']);
        $this->assertSame(999, FinanceSetting::current()->tax_invoice_serial_range_start);

        app(PreferenceMigrator::class)->run(force: true);
        $this->assertSame(100, FinanceSetting::current()->tax_invoice_serial_range_start);
    }

    public function test_dry_run_does_not_create_or_modify_settings(): void {
        Preference::create(['key' => 'tax_invoice_serial_range_start', 'value' => '100']);

        $report = app(PreferenceMigrator::class)->run(dryRun: true);

        $this->assertContains('tax_invoice_serial_range_start', $report['migrated']);
        $this->assertSame(0, FinanceSetting::query()->count());
    }

    public function test_invalid_value_is_reported_and_legacy_value_remains(): void {
        Preference::create(['key' => 'num_per_page', 'value' => 'not-a-number']);

        $report = app(PreferenceMigrator::class)->run();

        $this->assertArrayHasKey('num_per_page', $report['invalid']);
        $this->assertSame('not-a-number', Preference::find('num_per_page')->value);
    }

    public function test_destination_schema_is_checked_once_per_model(): void {
        foreach (['tax_invoice_serial_range_start' => 10, 'tax_invoice_serial_range_end' => 50, 'tax_invoice_serial_last_used' => 20] as $key => $value) {
            Preference::create(['key' => $key, 'value' => $value]);
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            app(PreferenceMigrator::class)->run(dryRun: true);
            $queries = DB::getQueryLog();
        } finally {
            DB::disableQueryLog();
        }

        $schemaQueries = array_filter($queries, fn (array $query): bool => str_contains($query['query'], 'sqlite_master') && str_contains($query['query'], 'finance_settings'));
        $this->assertCount(1, $schemaQueries);
    }
}
