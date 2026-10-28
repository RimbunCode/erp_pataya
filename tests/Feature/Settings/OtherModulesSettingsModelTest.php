<?php

namespace Tests\Feature\Settings;

use App\Http\Requests\Helpdesk\TicketRequest;
use App\Models\Asset\AssetSetting;
use App\Models\Helpdesk\HelpdeskSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Asset\Depreciation\DepreciationMethodFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Spec module-settings-other-modules, Task 2.2 (Requirements 1.1, 1.4, 2.1, 3.1; P-O5).
 */
class OtherModulesSettingsModelTest extends TestCase {
    use RefreshDatabase;

    public function test_new_settings_start_neutral(): void {
        $asset    = AssetSetting::current();
        $helpdesk = HelpdeskSetting::current();
        $sales    = SalesSetting::current();

        $this->assertNull($asset->default_depreciation_method);
        $this->assertNull($asset->default_frequency_of_depreciation);
        $this->assertNull($asset->default_total_number_of_depreciations);
        $this->assertNull($helpdesk->default_type);
        $this->assertNull($helpdesk->default_priority);
        $this->assertNull($helpdesk->default_due_days);
        $this->assertNull($sales->quotation_validity_days);
    }

    public function test_depreciation_methods_match_the_methods_the_factory_knows(): void {
        foreach (AssetSetting::DEPRECIATION_METHODS as $method) {
            $this->assertNotNull(DepreciationMethodFactory::make($method));
        }
        $this->assertCount(4, AssetSetting::DEPRECIATION_METHODS);
    }

    public function test_asset_rules_accept_known_methods_and_positive_integers_only(): void {
        $rules = AssetSetting::rules();

        foreach (['default_depreciation_method' => [null, 'straight_line', 'double_declining_balance', 'written_down_value', 'manual']] as $field => $valid) {
            foreach ($valid as $value) {
                $this->assertTrue(Validator::make([$field => $value], [$field => $rules[$field]])->passes(), "{$field}={$value}");
            }
        }
        $this->assertFalse(Validator::make(['m' => 'sum_of_years'], ['m' => $rules['default_depreciation_method']])->passes());

        foreach (['default_frequency_of_depreciation', 'default_total_number_of_depreciations'] as $field) {
            foreach ([null, 1, 12] as $value) {
                $this->assertTrue(Validator::make([$field => $value], [$field => $rules[$field]])->passes());
            }
            foreach ([0, -1, 1.5, 'abc'] as $value) {
                $this->assertFalse(Validator::make([$field => $value], [$field => $rules[$field]])->passes(), "{$field}=" . var_export($value, true));
            }
        }
    }

    public function test_helpdesk_rules_follow_the_ticket_request_options(): void {
        $rules = HelpdeskSetting::rules();

        foreach (['bug_problem', 'task', 'question', 'other', null] as $type) {
            $this->assertTrue(Validator::make(['default_type' => $type], ['default_type' => $rules['default_type']])->passes());
        }
        $this->assertFalse(Validator::make(['default_type' => 'incident'], ['default_type' => $rules['default_type']])->passes());

        foreach (['low', 'medium', 'high', 'critical', null] as $priority) {
            $this->assertTrue(Validator::make(['default_priority' => $priority], ['default_priority' => $rules['default_priority']])->passes());
        }
        $this->assertFalse(Validator::make(['default_priority' => 'urgent'], ['default_priority' => $rules['default_priority']])->passes());

        foreach ([null, 0, 7, 65535] as $days) {
            $this->assertTrue(Validator::make(['default_due_days' => $days], ['default_due_days' => $rules['default_due_days']])->passes());
        }
        foreach ([-1, 65536, 1.5] as $days) {
            $this->assertFalse(Validator::make(['default_due_days' => $days], ['default_due_days' => $rules['default_due_days']])->passes());
        }
    }

    public function test_ticket_options_stay_in_sync_with_the_ticket_request_rules(): void {
        $ticketRules = (new TicketRequest)->rules();

        $this->assertContains('in:' . implode(',', HelpdeskSetting::TICKET_TYPES), $ticketRules['type']);
        $this->assertContains('in:' . implode(',', HelpdeskSetting::TICKET_PRIORITIES), $ticketRules['priority']);
    }

    public function test_quotation_validity_days_rule(): void {
        $rule = ['quotation_validity_days' => SalesSetting::rules()['quotation_validity_days']];

        foreach ([null, 0, 30, 65535] as $value) {
            $this->assertTrue(Validator::make(['quotation_validity_days' => $value], $rule)->passes());
        }
        foreach ([-1, 65536, 2.5, 'x'] as $value) {
            $this->assertFalse(Validator::make(['quotation_validity_days' => $value], $rule)->passes());
        }
    }

    /** P-O5: akun fallback Asset dimiliki Finance P2, bukan asset_settings. */
    public function test_asset_settings_table_has_no_account_columns(): void {
        $columns = Schema::getColumnListing('asset_settings');

        $this->assertSame([], array_values(array_filter(
            $columns,
            fn (string $column): bool => str_contains($column, 'account'),
        )));
        $this->assertEqualsCanonicalizing(
            ['id', 'singleton', 'default_depreciation_method', 'default_frequency_of_depreciation', 'default_total_number_of_depreciations', 'created_at', 'updated_at'],
            $columns,
        );
        $this->assertSame(['default_depreciation_method', 'default_frequency_of_depreciation', 'default_total_number_of_depreciations'], array_keys(AssetSetting::rules()));
    }

    public function test_settings_are_singletons(): void {
        $first = HelpdeskSetting::current();

        $this->assertTrue($first->is(HelpdeskSetting::current()));
        $this->assertSame(1, HelpdeskSetting::query()->count());
    }
}
